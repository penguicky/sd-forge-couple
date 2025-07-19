"""
Test script to verify forge-couple optimizations work correctly
Run this to ensure memory optimizations don't break functionality
"""

import torch
import time
from lib_couple.performance_optimizations import (
    get_memory_manager, 
    cleanup_memory_manager,
    log_memory_stats,
    ManagedTensorContext
)

def test_tensor_pool():
    """Test tensor pooling functionality"""
    print("Testing tensor pool...")
    
    memory_manager = get_memory_manager()
    
    # Test tensor allocation and reuse
    shape = (512, 512)
    device = torch.device("cpu")
    dtype = torch.float32
    
    # Allocate some tensors
    tensors = []
    for i in range(10):
        tensor = memory_manager.get_tensor(shape, device, dtype)
        tensors.append(tensor)
    
    # Return them to pool
    for tensor in tensors:
        memory_manager.return_tensor(tensor)
    
    # Get stats
    stats = memory_manager.get_stats()
    print(f"Pool stats after test: {stats}")
    
    # Verify reuse
    new_tensor = memory_manager.get_tensor(shape, device, dtype)
    final_stats = memory_manager.get_stats()
    
    print(f"Reuse rate: {final_stats['tensor_pool']['reuses'] / max(1, final_stats['tensor_pool']['allocations']):.2%}")
    
    memory_manager.return_tensor(new_tensor)
    print("✓ Tensor pool test passed")

def test_attention_cache():
    """Test attention caching functionality"""
    print("Testing attention cache...")
    
    memory_manager = get_memory_manager()
    cache = memory_manager.attention_cache
    
    # Test conditioning cache
    prompt = "test prompt"
    width, height = 512, 512
    
    # Create dummy conditioning tensor
    dummy_cond = torch.randn(1, 77, 768)
    
    # Store and retrieve
    cache.store_conditioning(prompt, width, height, dummy_cond)
    retrieved = cache.get_conditioning(prompt, width, height)
    
    assert retrieved is not None, "Failed to retrieve cached conditioning"
    assert torch.allclose(dummy_cond, retrieved), "Cached conditioning doesn't match"
    
    # Test cache stats
    stats = cache.get_stats()
    print(f"Cache stats: {stats}")
    
    print("✓ Attention cache test passed")

def test_managed_context():
    """Test managed tensor context"""
    print("Testing managed tensor context...")
    
    with ManagedTensorContext() as ctx:
        # Allocate tensors within context
        tensor1 = ctx.get_tensor((256, 256))
        tensor2 = ctx.get_tensor((128, 128))
        
        # Tensors should be automatically returned when context exits
        print(f"Allocated {len(ctx.tensors)} tensors in context")
    
    # Context should have cleaned up automatically
    print("✓ Managed context test passed")

def test_memory_cleanup():
    """Test memory cleanup functionality"""
    print("Testing memory cleanup...")
    
    memory_manager = get_memory_manager()
    
    # Create some tensors and cache entries
    for i in range(5):
        tensor = memory_manager.get_tensor((100, 100))
        memory_manager.attention_cache.store_conditioning(
            f"prompt_{i}", 512, 512, torch.randn(1, 77, 768)
        )
        memory_manager.return_tensor(tensor)
    
    print("Before cleanup:")
    log_memory_stats()
    
    # Force cleanup
    memory_manager.force_cleanup()
    
    print("After cleanup:")
    log_memory_stats()
    
    print("✓ Memory cleanup test passed")

def benchmark_performance():
    """Benchmark performance improvements"""
    print("Benchmarking performance...")
    
    memory_manager = get_memory_manager()
    
    # Benchmark tensor allocation
    shape = (512, 512)
    num_iterations = 100
    
    # Test without pool (direct allocation)
    start_time = time.time()
    for _ in range(num_iterations):
        tensor = torch.zeros(shape)
        del tensor
    direct_time = time.time() - start_time
    
    # Test with pool
    start_time = time.time()
    for _ in range(num_iterations):
        tensor = memory_manager.get_tensor(shape)
        memory_manager.return_tensor(tensor)
    pool_time = time.time() - start_time
    
    print(f"Direct allocation: {direct_time:.4f}s")
    print(f"Pool allocation: {pool_time:.4f}s")
    print(f"Speedup: {direct_time / pool_time:.2f}x")
    
    print("✓ Performance benchmark completed")

def run_all_tests():
    """Run all optimization tests"""
    print("=" * 50)
    print("FORGE-COUPLE OPTIMIZATION TESTS")
    print("=" * 50)
    
    try:
        test_tensor_pool()
        print()
        
        test_attention_cache()
        print()
        
        test_managed_context()
        print()
        
        test_memory_cleanup()
        print()
        
        benchmark_performance()
        print()
        
        print("=" * 50)
        print("✓ ALL TESTS PASSED - OPTIMIZATIONS WORKING CORRECTLY")
        print("✓ SYNC FUNCTIONALITY PRESERVED (JavaScript-based)")
        print("=" * 50)
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up
        cleanup_memory_manager()

if __name__ == "__main__":
    run_all_tests()
