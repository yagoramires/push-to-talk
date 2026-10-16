# Inglês

App desktop (Electron + React + TypeScript) de aulas de inglês para brasileiros, com prática de fala em modo solo e em modo guiado com professor.

## Como rodar

```bash
npm install
npm run dev
npm test
```

## Transcrição

Em desenvolvimento, a transcrição de voz precisa do `whisper-cli` instalado e do modelo `~/.cache/whisper/ggml-small.bin`. Para usar outros caminhos, defina as variáveis de ambiente `WHISPER_BIN` e `WHISPER_MODEL`.
