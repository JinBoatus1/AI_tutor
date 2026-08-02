# AI Tutor Local LLM Deployment

AI Tutor uses one OpenAI-compatible Chat Completions gateway for cloud OpenAI,
Windows llama.cpp or LM Studio, and Linux vLLM. Existing application modules keep
calling `deps.create_chat_completion(...)`; deployment changes only environment
variables and the inference server.

## Runtime layout

```text
AI Tutor modules
    -> backend/deps.py
    -> backend/llm/gateway.py
    -> POST {LLM_BASE_URL}/chat/completions
       -> Windows: llama.cpp or LM Studio
       -> Linux server: vLLM
```

The gateway preserves the OpenAI Python SDK response shape. When `LLM_MODEL` is
set, it replaces hard-coded cloud model names from legacy modules. Requests with
images prefer `LLM_VISION_MODEL`; requests with tools prefer `LLM_TOOL_MODEL`.

The request code remains the same for every backend:

```python
from openai import OpenAI

client = OpenAI(base_url="http://127.0.0.1:8080/v1", api_key="local")
response = client.chat.completions.create(
    model="aitutor-main",
    messages=[{"role": "user", "content": "Explain induction."}],
)
print(response.choices[0].message.content)
```

## Test without a model

Use mock mode to verify imports, API routing, and simple chat plumbing before a
model is downloaded:

```env
LLM_PROVIDER=mock
LLM_MODEL=aitutor-main
```

The mock returns a fixed text response. It does not perform OCR, grading, JSON
generation, or tool calls.

## Windows: llama.cpp

llama.cpp is the recommended native Windows test server because it is
command-line driven and exposes `/v1/chat/completions` and `/v1/models`, like
vLLM. Download a Windows `llama-server.exe` build and a GGUF model, then run:

```powershell
$env:LLAMA_SERVER_EXE = "C:\llama.cpp\llama-server.exe"
$env:LLM_MODEL_PATH = "C:\models\aitutor-main-q4_k_m.gguf"
$env:LLM_MODEL = "aitutor-main"
.\scripts\start_local_llm.ps1
```

Backend environment:

```env
LLM_PROVIDER=openai_compatible
LLM_BACKEND=llama_cpp
LLM_BASE_URL=http://127.0.0.1:8080/v1
LLM_API_KEY=local
LLM_MODEL=aitutor-main
LLM_TOOL_MODEL=aitutor-main
LLM_TIMEOUT_SECONDS=180
```

For a multimodal GGUF model, also set the projector if that model requires one:

```powershell
$env:LLM_MM_PROJ_PATH = "C:\models\mmproj-aitutor-vision-f16.gguf"
```

Set `LLM_VISION_MODEL` to the alias served by the multimodal process. If text and
vision models run simultaneously, start them on different ports and place a
small OpenAI-compatible proxy in front, or initially run one model at a time and
change `LLM_BASE_URL`.

LM Studio is also supported. Start its local server and normally use:

```env
LLM_PROVIDER=openai_compatible
LLM_BACKEND=lm_studio
LLM_BASE_URL=http://127.0.0.1:1234/v1
LLM_API_KEY=local
LLM_MODEL=<model identifier returned by GET /v1/models>
```

## Linux server: vLLM

On the deployment server, provide the Hugging Face model path or repository id:

```bash
export LLM_MODEL_PATH=/models/aitutor-main
export LLM_MODEL=aitutor-main
export LLM_API_KEY=replace-with-a-private-token
bash ./scripts/start_vllm.sh
```

AI Tutor backend environment:

```env
LLM_PROVIDER=openai_compatible
LLM_BACKEND=vllm
LLM_BASE_URL=http://127.0.0.1:8000/v1
LLM_API_KEY=replace-with-a-private-token
LLM_MODEL=aitutor-main
LLM_TOOL_MODEL=aitutor-main
LLM_TIMEOUT_SECONDS=180
```

Model-specific vLLM flags such as `--enable-auto-tool-choice`,
`--tool-call-parser`, `--reasoning-parser`, `--tensor-parallel-size`, and
multimodal limits should be added after choosing the exact model. They cannot be
selected safely from parameter count alone.

## Model file contract

### vLLM / Hugging Face format

A text model directory should contain:

```text
config.json
tokenizer.json or tokenizer.model
tokenizer_config.json
special_tokens_map.json (recommended)
generation_config.json (recommended)
chat_template.jinja or a chat_template in tokenizer_config.json
model.safetensors or model-00001-of-000NN.safetensors
model.safetensors.index.json (for sharded weights)
```

Quantized AWQ/GPTQ repositories additionally need their quantization metadata,
usually in `config.json` or `quantization_config.json`. A vision-language model
also needs its processor files, commonly `processor_config.json`,
`preprocessor_config.json`, and any model-specific image processor/tokenizer
files. Always retain every non-weight configuration file from the original
Hugging Face repository.

### llama.cpp / Windows format

A text deployment needs one GGUF file, preferably an instruct/chat quantization:

```text
aitutor-main-q4_k_m.gguf
```

A multimodal deployment may additionally require:

```text
aitutor-vision-q4_k_m.gguf
mmproj-aitutor-vision-f16.gguf
```

Choose a Hugging Face model that has both original Safetensors weights and a
trusted GGUF conversion. The model or its GGUF metadata must contain the correct
chat template. Tool calling also requires a tool-capable template and the
matching llama.cpp/vLLM launch flags.

Do not commit model weights to this repository. `.gguf`, `.safetensors`, and the
workspace-level `models/` directory are ignored by the repository.

## Capability registry

`backend/llm/model_registry.json` documents the aliases and capabilities exposed
to AI Tutor:

- `text`: ordinary chat and text grading.
- `vision`: image/PDF-page requests used by AutoGrader and textbook OCR. The
  vision model also needs `tools` for tutor chats that combine attachments with
  the memory tool.
- `tools`: memory tool calls.
- `json`: structured or schema-constrained output.

If a registered model lacks a capability required by a request, the gateway
returns an explicit HTTP 503 instead of sending a request that is known to be
invalid. Unknown model names are allowed so new models can be tested before the
registry is updated. Set `LLM_VALIDATE_CAPABILITIES=false` only for temporary
compatibility experiments.

## Health checks

Configuration only, with no inference-server request:

```text
GET /api/llm/health
```

Check the provider's `/v1/models` endpoint:

```text
GET /api/llm/health?check_remote=true
```

The response never includes the API key.
