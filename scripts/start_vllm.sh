#!/usr/bin/env bash
set -euo pipefail

: "${LLM_MODEL_PATH:?Set LLM_MODEL_PATH to a Hugging Face model directory or repository id}"

LLM_MODEL="${LLM_MODEL:-aitutor-main}"
LLM_API_KEY="${LLM_API_KEY:-local}"
LLM_PORT="${LLM_PORT:-8100}"
LLM_CONTEXT_SIZE="${LLM_CONTEXT_SIZE:-16384}"
VLLM_GPU_MEMORY_UTILIZATION="${VLLM_GPU_MEMORY_UTILIZATION:-0.90}"
VLLM_TOOL_CALL_PARSER="${VLLM_TOOL_CALL_PARSER:-}"
VLLM_REASONING_PARSER="${VLLM_REASONING_PARSER:-}"
VLLM_MM_LIMIT="${VLLM_MM_LIMIT:-}"

args=(
  serve "$LLM_MODEL_PATH"
  --served-model-name "$LLM_MODEL"
  --host 0.0.0.0
  --port "$LLM_PORT"
  --api-key "$LLM_API_KEY"
  --max-model-len "$LLM_CONTEXT_SIZE"
  --gpu-memory-utilization "$VLLM_GPU_MEMORY_UTILIZATION"
)

if [[ -n "$VLLM_TOOL_CALL_PARSER" ]]; then
  args+=(--enable-auto-tool-choice --tool-call-parser "$VLLM_TOOL_CALL_PARSER")
fi
if [[ -n "$VLLM_REASONING_PARSER" ]]; then
  args+=(--reasoning-parser "$VLLM_REASONING_PARSER")
fi
if [[ -n "$VLLM_MM_LIMIT" ]]; then
  args+=(--limit-mm-per-prompt "$VLLM_MM_LIMIT")
fi

exec vllm "${args[@]}"
