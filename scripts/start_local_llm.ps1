param(
    [string]$ServerExe = $env:LLAMA_SERVER_EXE,
    [string]$ModelPath = $env:LLM_MODEL_PATH,
    [string]$ModelAlias = $(if ($env:LLM_MODEL) { $env:LLM_MODEL } else { "aitutor-main" }),
    [string]$MmprojPath = $env:LLM_MM_PROJ_PATH,
    [int]$Port = $(if ($env:LLM_PORT) { [int]$env:LLM_PORT } else { 8080 }),
    [int]$ContextSize = $(if ($env:LLM_CONTEXT_SIZE) { [int]$env:LLM_CONTEXT_SIZE } else { 16384 })
)

$ErrorActionPreference = "Stop"

if (-not $ServerExe) {
    throw "Set LLAMA_SERVER_EXE or pass -ServerExe with the path to llama-server.exe."
}
if (-not (Test-Path -LiteralPath $ServerExe -PathType Leaf)) {
    throw "llama-server executable not found: $ServerExe"
}
if (-not $ModelPath) {
    throw "Set LLM_MODEL_PATH or pass -ModelPath with the path to a GGUF model."
}
if (-not (Test-Path -LiteralPath $ModelPath -PathType Leaf)) {
    throw "GGUF model not found: $ModelPath"
}
if ($MmprojPath -and -not (Test-Path -LiteralPath $MmprojPath -PathType Leaf)) {
    throw "Multimodal projector not found: $MmprojPath"
}

$serverArgs = @(
    "--model", (Resolve-Path -LiteralPath $ModelPath).Path,
    "--alias", $ModelAlias,
    "--host", "127.0.0.1",
    "--port", $Port,
    "--ctx-size", $ContextSize,
    "--jinja"
)
if ($MmprojPath) {
    $serverArgs += @("--mmproj", (Resolve-Path -LiteralPath $MmprojPath).Path)
}

Write-Host "Starting llama.cpp model '$ModelAlias' at http://127.0.0.1:$Port/v1"
& (Resolve-Path -LiteralPath $ServerExe).Path @serverArgs
