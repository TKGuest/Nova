@echo off
cd /d "%~dp0"

:: Set environment configurations
set AIDER_VOICE=
set OLLAMA_CONTEXT_LENGTH=8192
set OLLAMA_API_BASE=http://localhost:11434

:: Run Aider specifying your local model and map tokens directly
aider --model ollama_chat/qwen2.5-coder:14b --map-tokens 2048
pause

