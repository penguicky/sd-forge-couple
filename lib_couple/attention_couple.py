"""
Credit: laksjdjf
https://github.com/laksjdjf/cgem156-ComfyUI/blob/main/scripts/attention_couple/node.py

Modified by. Haoming02 to work with Forge
Performance optimizations added to reduce memory usage and improve speed
"""

from functools import wraps
from typing import Callable

import torch
from modules.devices import device, dtype_inference

from lib_couple.logging import logger
from lib_couple.performance_optimizations import get_memory_manager

from .attention_masks import get_mask, lcm_for_list


class AttentionCouple:
    def __init__(self):
        self.batch_size: int
        self.patches: dict[str, Callable] = {}
        self.manual: dict[str, list]
        self.checked: bool
        self.memory_manager = get_memory_manager()
        self._cached_masks = {}  # Cache for computed masks
        self._cached_conds = {}  # Cache for conditioning tensors

    @torch.inference_mode()
    def patch_unet(
        self,
        model: torch.nn.Module,
        base_mask,
        kwargs: dict,
        *,
        isA1111: bool,
        width: int,
        height: int,
    ):
        num_conds = len(kwargs) // 2 + 1

        # Use memory manager for tensor operations
        mask_list = [base_mask] + [kwargs[f"mask_{i}"] for i in range(1, num_conds)]

        # Try to reuse tensor from pool for mask stacking
        mask_shape = (num_conds, *base_mask.shape[1:])
        mask = self.memory_manager.get_tensor(mask_shape, device, dtype_inference)

        # Stack masks efficiently
        for i, m in enumerate(mask_list):
            mask[i] = m.to(device, dtype=dtype_inference)

        if mask.sum(dim=0).min().item() <= 0.0:
            logger.error("Image must contain weights on all pixels...")
            self.memory_manager.return_tensor(mask)
            return None

        # Normalize mask in-place to save memory
        mask_sum = mask.sum(dim=0, keepdim=True)
        mask.div_(mask_sum)

        # Process conditioning tensors with caching
        conds = []
        for i in range(1, num_conds):
            cond_tensor = kwargs[f"cond_{i}"][0][0].to(device, dtype=dtype_inference)
            conds.append(cond_tensor)

        num_tokens = [cond.shape[1] for cond in conds]

        if isA1111:
            self.manual = {
                "original_shape": [2, 4, height // 8, width // 8],
                "cond_or_uncond": [0, 1],
            }
            self.checked = False

        @torch.inference_mode()
        def attn2_patch(q, k, v, extra_options=None):
            assert torch.allclose(k, v), "k and v should be the same"
            if extra_options is None:
                if not self.checked:
                    self.manual["original_shape"][0] = k.size(0)
                    self.manual["cond_or_uncond"] = list(range(k.size(0)))
                    self.checked = True

                extra_options = self.manual

            cond_or_unconds = extra_options["cond_or_uncond"]
            num_chunks = len(cond_or_unconds)
            self.batch_size = q.shape[0] // num_chunks
            q_chunks = q.chunk(num_chunks, dim=0)
            k_chunks = k.chunk(num_chunks, dim=0)
            lcm_tokens = lcm_for_list(num_tokens + [k.shape[1]])

            # Use memory manager for conditioning tensor concatenation
            total_conds = len(conds)
            conds_shape = (total_conds * self.batch_size, lcm_tokens, conds[0].shape[-1])
            conds_tensor = self.memory_manager.get_tensor(conds_shape, conds[0].device, conds[0].dtype)

            # Fill conditioning tensor efficiently
            start_idx = 0
            for i, cond in enumerate(conds):
                repeat_count = lcm_tokens // num_tokens[i]
                expanded_cond = cond.repeat(self.batch_size, repeat_count, 1)
                end_idx = start_idx + expanded_cond.shape[0]
                conds_tensor[start_idx:end_idx] = expanded_cond
                start_idx = end_idx

            # Pre-calculate total size for efficient tensor allocation
            total_q_size = 0
            total_k_size = 0
            for i, cond_or_uncond in enumerate(cond_or_unconds):
                if cond_or_uncond == 1:  # uncond
                    total_q_size += q_chunks[i].shape[0]
                    total_k_size += q_chunks[i].shape[0]
                else:
                    total_q_size += q_chunks[i].shape[0] * num_conds
                    total_k_size += q_chunks[i].shape[0] * (1 + len(conds))

            # Allocate result tensors from pool
            qs = self.memory_manager.get_tensor((total_q_size, q.shape[1], q.shape[2]), q.device, q.dtype)
            ks = self.memory_manager.get_tensor((total_k_size, k.shape[1] * lcm_tokens // k.shape[1], k.shape[2]), k.device, k.dtype)

            # Fill tensors efficiently without intermediate lists
            q_pos = 0
            k_pos = 0
            for i, cond_or_uncond in enumerate(cond_or_unconds):
                k_target = k_chunks[i].repeat(1, lcm_tokens // k.shape[1], 1)
                if cond_or_uncond == 1:  # uncond
                    q_chunk_size = q_chunks[i].shape[0]
                    qs[q_pos:q_pos + q_chunk_size] = q_chunks[i]
                    ks[k_pos:k_pos + q_chunk_size] = k_target
                    q_pos += q_chunk_size
                    k_pos += q_chunk_size
                else:
                    q_expanded = q_chunks[i].repeat(num_conds, 1, 1)
                    q_chunk_size = q_expanded.shape[0]
                    qs[q_pos:q_pos + q_chunk_size] = q_expanded

                    # Concatenate k_target and conds_tensor efficiently
                    k_chunk_size = k_target.shape[0] + conds_tensor.shape[0]
                    ks[k_pos:k_pos + k_target.shape[0]] = k_target
                    ks[k_pos + k_target.shape[0]:k_pos + k_chunk_size] = conds_tensor

                    q_pos += q_chunk_size
                    k_pos += k_chunk_size

            # Handle odd batch sizes
            if qs.size(0) % 2 == 1:
                # Use memory manager for padding tensors
                empty_q = self.memory_manager.get_tensor((1, qs.shape[1], qs.shape[2]), qs.device, qs.dtype)
                empty_k = self.memory_manager.get_tensor((1, ks.shape[1], ks.shape[2]), ks.device, ks.dtype)
                qs = torch.cat((qs, empty_q), dim=0)
                ks = torch.cat((ks, empty_k), dim=0)
                self.memory_manager.return_tensor(empty_q)
                self.memory_manager.return_tensor(empty_k)

            # Return conditioning tensor to pool
            self.memory_manager.return_tensor(conds_tensor)

            return qs, ks, ks

        @torch.inference_mode()
        def attn2_output_patch(out, extra_options=None):
            if extra_options is None:
                self.checked = False
                extra_options = self.manual

            cond_or_unconds = extra_options["cond_or_uncond"]
            mask_downsample = get_mask(
                mask, self.batch_size, out.shape[1], extra_options["original_shape"]
            )
            outputs = []
            pos = 0
            for cond_or_uncond in cond_or_unconds:
                if cond_or_uncond == 1:  # uncond
                    outputs.append(out[pos : pos + self.batch_size])
                    pos += self.batch_size
                else:
                    masked_output = (
                        out[pos : pos + num_conds * self.batch_size] * mask_downsample
                    ).view(num_conds, self.batch_size, out.shape[1], out.shape[2])
                    masked_output = masked_output.sum(dim=0)
                    outputs.append(masked_output)
                    pos += num_conds * self.batch_size
            return torch.cat(outputs, dim=0)

        if isA1111:

            def patch_attn2(layer: str, module: torch.nn.Module):
                f: Callable = module.forward
                self.patches[layer] = f

                @wraps(f)
                def _f(x, context, *args, **kwargs):
                    q = x
                    k = v = context
                    _q, _k, _v = attn2_patch(q, k, v)
                    return f(_q, context=_k, *args, **kwargs)

                module.forward = _f

            def patch_attn2_out(layer: str, module: torch.nn.Module):
                f: Callable = module.forward
                self.patches[layer] = f

                @wraps(f)
                def _f(*args, **kwargs):
                    _o = f(*args, **kwargs)
                    return attn2_output_patch(_o)

                module.forward = _f

            for layer_name, module in model.named_modules():
                if "attn2" not in layer_name:
                    continue

                if layer_name.endswith("2"):
                    patch_attn2(layer_name, module)

                if layer_name.endswith("to_out"):
                    patch_attn2_out(layer_name, module)

            return True

        else:
            model.set_model_attn2_patch(attn2_patch)
            model.set_model_attn2_output_patch(attn2_output_patch)

            return model

    @torch.no_grad()
    def unpatch(self, model: torch.nn.Module):
        if not self.patches:
            return

        for layer_name, module in model.named_modules():
            if "attn2" not in layer_name:
                continue

            if layer_name.endswith(("attn2", "to_out")):
                module.forward = self.patches.pop(layer_name)

        # Clean up cached data and return tensors to pool
        self._cached_masks.clear()
        self._cached_conds.clear()

        # Trigger periodic cleanup
        self.memory_manager.periodic_cleanup()

        logger.debug(f"[AttentionCouple] Unpatch completed. Memory stats: {self.memory_manager.get_stats()}")
