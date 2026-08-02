#!/usr/bin/env bash
set -euo pipefail

: "${LLM_MODEL_PATH:?Set LLM_MODEL_PATH to a Hugging Face model directory or repository id}"

LLM_MODEL="${LLM_MODEL:-aitutor-main}"
LLM_API_KEY="${LLM_API_KEY:-local}"
LLM_PORT="${LLM_PORT:-8000}"
LLM_CONTEXT_SIZE="${LLM_CONTEXT_SIZE:-16384}"

exec vllm serve "$LLM_MODEL_PATH" \
  --served-model-name "$LLM_MODEL" \
  --host 0.0.0.0 \
  --port "$LLM_PORT" \
  --api-key "$LLM_API_KEY" \
  --max-model-len "$LLM_CONTEXT_SIZE"
