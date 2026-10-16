# Inglês

App desktop (Electron + React + TypeScript) de aulas de inglês para brasileiros, com prática de fala em modo solo e em modo guiado com professor.

## Como rodar

```bash
npm install
npm run dev
npm test
```

## Transcrição

A transcrição roda localmente com `@huggingface/transformers` (Whisper base.en, q8). O app procura o modelo em `<userData>/models` (sem baixar nada por enquanto; o download gerenciado vem no Plano 2, Task 5). Para desenvolver, baixe o modelo uma vez (~77 MB) com:

```bash
INGLES_DOWNLOAD_MODELS=1 npm test
```

Isso salva o modelo em `~/.cache/ingles-models`. Copie a pasta `onnx-community/` dali para `<userData>/models/` para o app encontrá-lo. Sem o modelo, o app mostra a falha de transcrição e oferece a marcação manual.
