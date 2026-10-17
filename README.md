# Push to Talk

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

## Gerar os instaladores

O app sai como DMG para Mac (Apple Silicon) e instalador NSIS para Windows (x64), sem assinatura de código. Os modelos de IA não vão no instalador: o app baixa na primeira abertura.

**Mac, local:**

```bash
npm run build:mac
"dist/mac-arm64/Push to Talk.app/Contents/MacOS/Push to Talk" --self-check
```

O DMG fica em `dist/Push-to-Talk-<versão>-mac-arm64.dmg`. Na primeira abertura, o macOS bloqueia o app não assinado: clique com o botão direito no app → "Abrir" → "Abrir mesmo assim".

**Windows, pelo GitHub Actions** (`.github/workflows/build.yml` gera os dois instaladores e roda o `--self-check` em cada um):

1. Crie o repositório no GitHub, adicione o remote e rode `git push`.
2. Crie a tag da versão: `git tag v1.0.0 && git push --tags`.
3. Quando o workflow terminar, abra a aba "Releases": há um rascunho com o `.exe` e o `.dmg`. Confira e publique.

Também dá para rodar o workflow na mão ("Actions" → "build" → "Run workflow"); aí os instaladores ficam só nos artefatos da execução, sem release.

Cada push no `main` roda só o build do Windows (testes, instalador e `--self-check`), para pegar cedo o que quebra lá; o `.exe` fica nos artefatos da execução. O Mac só entra com tag ou na mão, porque o minuto de máquina Mac custa 10x no GitHub.

Para testar no Windows, siga o roteiro em [docs/teste-windows.md](docs/teste-windows.md).

## Android

O APK (`Push-to-Talk-<versão>-android.apk`, só arm64) sai do mesmo workflow: baixe o artifact `installer-Android` ou, numa release, o `.apk` do rascunho. Para instalar, abra o arquivo no celular e permita "Instalar apps de fontes desconhecidas" quando o Android pedir.

A IA de conversa só liga em celulares com pelo menos 6 GB de RAM; nos outros, o resto do app funciona normalmente.

Local: `npm run build:android` gera `android/app/build/outputs/apk/release/app-release.apk`. Sem as variáveis `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`, o APK sai com a chave de debug (serve para testar, não para distribuir). No CI elas vêm dos secrets `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`; guarde um backup da `.jks`, sem ela nenhuma atualização instala por cima.
