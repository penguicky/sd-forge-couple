"""
Performance optimizations for forge-couple extension
Implements tensor pooling, caching, and memory management improvements
"""

import hashlib
import weakref
from functools import lru_cache
from typing import Dict, Tuple, Optional, Any
import gc

import torch
from modules.devices import device, dtype_inference

from lib_couple.logging import logger


class TensorPool:
    """
    Memory pool for reusing tensors to reduce allocation overhead
    """
    
    def __init__(self, max_pool_size: int = 50):
        self.pools: Dict[Tuple, list] = {}
        self.max_pool_size = max_pool_size
        self.allocation_count = 0
        self.reuse_count = 0
    
    def get_tensor(self, shape: Tuple[int, ...], device: torch.device, dtype: torch.dtype) -> torch.Tensor:
        """Get a tensor from pool or create new one"""
        key = (shape, device, dtype)
        
        if key in self.pools and self.pools[key]:
            tensor = self.pools[key].pop()
            tensor.zero_()  # Clear the tensor
            self.reuse_count += 1
            return tensor
        
        # Create new tensor if pool is empty
        tensor = torch.zeros(shape, device=device, dtype=dtype)
        self.allocation_count += 1
        return tensor
    
    def return_tensor(self, tensor: torch.Tensor):
        """Return tensor to pool for reuse"""
        if tensor is None:
            return
            
        key = (tuple(tensor.shape), tensor.device, tensor.dtype)
        
        if key not in self.pools:
            self.pools[key] = []
        
        # Only keep up to max_pool_size tensors per configuration
        if len(self.pools[key]) < self.max_pool_size:
            self.pools[key].append(tensor.detach())
    
    def clear_pool(self):
        """Clear all pooled tensors and force garbage collection"""
        for pool in self.pools.values():
            pool.clear()
        self.pools.clear()
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    
    def get_stats(self) -> Dict[str, int]:
        """Get pool statistics"""
        total_pooled = sum(len(pool) for pool in self.pools.values())
        return {
            "allocations": self.allocation_count,
            "reuses": self.reuse_count,
            "pooled_tensors": total_pooled,
            "pool_configurations": len(self.pools)
        }


class AttentionCache:
    """
    Cache for attention masks and conditioning tensors
    """
    
    def __init__(self, max_cache_size: int = 100):
        self.mask_cache: Dict[str, torch.Tensor] = {}
        self.conditioning_cache: Dict[str, torch.Tensor] = {}
        self.max_cache_size = max_cache_size
        self.cache_hits = 0
        self.cache_misses = 0
    
    def _generate_hash(self, data: Any) -> str:
        """Generate hash for cache key"""
        if isinstance(data, torch.Tensor):
            # Use tensor shape and a sample of values for hash
            shape_str = str(data.shape)
            if data.numel() > 0:
                sample = data.flatten()[:min(100, data.numel())].cpu().numpy().tobytes()
                return hashlib.md5(shape_str.encode() + sample).hexdigest()
            return hashlib.md5(shape_str.encode()).hexdigest()
        elif isinstance(data, (list, tuple)):
            return hashlib.md5(str(data).encode()).hexdigest()
        else:
            return hashlib.md5(str(data).encode()).hexdigest()
    
    def get_mask(self, mask_data: Any, width: int, height: int) -> Optional[torch.Tensor]:
        """Get cached mask or None if not found"""
        cache_key = f"mask_{self._generate_hash(mask_data)}_{width}_{height}"
        
        if cache_key in self.mask_cache:
            self.cache_hits += 1
            return self.mask_cache[cache_key].clone()
        
        self.cache_misses += 1
        return None
    
    def store_mask(self, mask_data: Any, width: int, height: int, mask: torch.Tensor):
        """Store mask in cache"""
        cache_key = f"mask_{self._generate_hash(mask_data)}_{width}_{height}"
        
        # Implement LRU eviction if cache is full
        if len(self.mask_cache) >= self.max_cache_size:
            # Remove oldest entry (simple FIFO for now)
            oldest_key = next(iter(self.mask_cache))
            del self.mask_cache[oldest_key]
        
        self.mask_cache[cache_key] = mask.clone()
    
    def get_conditioning(self, prompt: str, width: int, height: int) -> Optional[torch.Tensor]:
        """Get cached conditioning tensor or None if not found"""
        cache_key = f"cond_{hashlib.md5(prompt.encode()).hexdigest()}_{width}_{height}"
        
        if cache_key in self.conditioning_cache:
            self.cache_hits += 1
            return self.conditioning_cache[cache_key]
        
        self.cache_misses += 1
        return None
    
    def store_conditioning(self, prompt: str, width: int, height: int, conditioning: torch.Tensor):
        """Store conditioning tensor in cache"""
        cache_key = f"cond_{hashlib.md5(prompt.encode()).hexdigest()}_{width}_{height}"
        
        # Implement LRU eviction if cache is full
        if len(self.conditioning_cache) >= self.max_cache_size:
            # Remove oldest entry (simple FIFO for now)
            oldest_key = next(iter(self.conditioning_cache))
            del self.conditioning_cache[oldest_key]
        
        self.conditioning_cache[cache_key] = conditioning
    
    def clear_cache(self):
        """Clear all cached data"""
        self.mask_cache.clear()
        self.conditioning_cache.clear()
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    
    def get_stats(self) -> Dict[str, int]:
        """Get cache statistics"""
        return {
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses,
            "hit_rate": self.cache_hits / max(1, self.cache_hits + self.cache_misses),
            "mask_cache_size": len(self.mask_cache),
            "conditioning_cache_size": len(self.conditioning_cache)
        }


class MemoryManager:
    """
    Centralized memory management for forge-couple
    """
    
    def __init__(self):
        self.tensor_pool = TensorPool()
        self.attention_cache = AttentionCache()
        self.active_tensors = weakref.WeakSet()
        self.cleanup_threshold = 100  # Cleanup after this many operations
        self.operation_count = 0
    
    def get_tensor(self, shape: Tuple[int, ...], device: torch.device = None, dtype: torch.dtype = None) -> torch.Tensor:
        """Get tensor from pool with automatic device/dtype inference"""
        if device is None:
            device = device
        if dtype is None:
            dtype = dtype_inference
        
        tensor = self.tensor_pool.get_tensor(shape, device, dtype)
        self.active_tensors.add(tensor)
        return tensor
    
    def return_tensor(self, tensor: torch.Tensor):
        """Return tensor to pool"""
        if tensor in self.active_tensors:
            self.active_tensors.discard(tensor)
        self.tensor_pool.return_tensor(tensor)
    
    def periodic_cleanup(self):
        """Perform periodic cleanup of memory"""
        self.operation_count += 1
        
        if self.operation_count >= self.cleanup_threshold:
            self.operation_count = 0
            
            # Force garbage collection
            gc.collect()
            
            # Clear CUDA cache if available
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            logger.debug(f"[MemoryManager] Periodic cleanup completed. Stats: {self.get_stats()}")
    
    def force_cleanup(self):
        """Force immediate cleanup of all cached data"""
        self.tensor_pool.clear_pool()
        self.attention_cache.clear_cache()
        self.active_tensors.clear()
        self.operation_count = 0
        
        # Force garbage collection
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        logger.info("[MemoryManager] Force cleanup completed")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive memory management statistics"""
        return {
            "tensor_pool": self.tensor_pool.get_stats(),
            "attention_cache": self.attention_cache.get_stats(),
            "active_tensors": len(self.active_tensors),
            "operation_count": self.operation_count
        }


# Global memory manager instance
_memory_manager = None

def get_memory_manager() -> MemoryManager:
    """Get global memory manager instance"""
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = MemoryManager()
    return _memory_manager

def cleanup_memory_manager():
    """Cleanup global memory manager"""
    global _memory_manager
    if _memory_manager is not None:
        _memory_manager.force_cleanup()
        _memory_manager = None

def log_memory_stats():
    """Log current memory statistics for debugging"""
    global _memory_manager
    if _memory_manager is not None:
        stats = _memory_manager.get_stats()
        logger.info(f"[MemoryManager] Current stats: {stats}")

        # Log CUDA memory if available
        if torch.cuda.is_available():
            allocated = torch.cuda.memory_allocated() / 1024**3  # GB
            cached = torch.cuda.memory_reserved() / 1024**3  # GB
            logger.info(f"[MemoryManager] CUDA memory - Allocated: {allocated:.2f}GB, Cached: {cached:.2f}GB")

# Context manager for automatic memory cleanup
class ManagedTensorContext:
    """Context manager for automatic tensor cleanup"""

    def __init__(self):
        self.tensors = []
        self.memory_manager = get_memory_manager()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Return all tensors to pool
        for tensor in self.tensors:
            self.memory_manager.return_tensor(tensor)
        self.tensors.clear()

    def get_tensor(self, shape, device=None, dtype=None):
        """Get tensor and track it for cleanup"""
        tensor = self.memory_manager.get_tensor(shape, device, dtype)
        self.tensors.append(tensor)
        return tensor
