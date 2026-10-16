# Plano 3 — Empacotamento e distribuição (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar um DMG para Mac (arm64) e um instalador NSIS para Windows (x64, via GitHub Actions) que trazem o app e o curso, pedem o microfone e rodam a IA local, mais um roteiro de teste em português para o notebook Windows deles.

**Architecture:** O `electron-builder.yml` passa a descrever o app de verdade: nome, `extraResources` com o curso e o `benchmark.wav`, módulos nativos fora do asar e só os binários da plataforma alvo. O main ganha um modo `--self-check` que carrega o curso e importa os módulos de IA, e sai com 0 ou 1. Esse modo é o teste do pacote: roda no Mac local e no CI do Windows, sem abrir janela. Um workflow do GitHub Actions gera os dois instaladores e roda o self-check no app desempacotado.

**Tech Stack:** electron-builder 26 (já instalado), GitHub Actions (`windows-latest`, `macos-latest`). Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-10-15-app-ingles-design.md` (seções "Plataforma e distribuição" e "Restrições e riscos conhecidos").

## Global Constraints

- **Plataformas:** Mac arm64 (DMG) e Windows x64 (NSIS). Linux fica de fora: remover os alvos de Linux e o `publish` genérico do scaffold.
- **Sem assinatura de código e sem atualização automática.** No Mac, a assinatura ad-hoc do electron-builder basta para o app abrir em arm64. A pessoa abre com "Abrir mesmo assim". No Windows, o caminho é "Mais informações → Executar assim mesmo".
- **O instalador não traz modelos.** Eles continuam sendo baixados na primeira abertura (Plano 2).
- **Identidade:** `appId: br.ingles.app`, `productName: Inglês`, `executableName: Ingles`. Artefatos: `Ingles-${version}-mac-arm64.dmg` e `Ingles-${version}-setup.exe`.
- **Microfone:** a descrição do pedido no Mac fica em português: "O app usa o microfone para ouvir e corrigir a sua fala. Nada do que você fala sai do computador." O entitlement `com.apple.security.device.audio-input` entra no plist. Os pedidos de câmera, Documentos e Downloads do scaffold saem.
- **Tamanho:** cada instalador leva só os binários da sua plataforma. Isso vale para `onnxruntime-node/bin/napi-v6/<plataforma>` e para os pacotes `@node-llama-cpp/*`. As variantes CUDA do node-llama-cpp ficam fora, porque o notebook alvo tem vídeo integrado; o Vulkan e a CPU ficam. Meta: instalador do Windows abaixo de 400 MB. Registrar o tamanho real no relatório.
- **Rede e GitHub:** o repositório não tem remote. Este plano escreve o workflow e testa tudo o que dá para testar localmente. Criar o repositório e dar push fica com o usuário.
- **Textos para pessoas** (roteiro de teste, mensagens): em português.

## Review Focus

1. **Curso ou `benchmark.wav` fora do pacote:** o app instalado abre, mas o curso não carrega ou o benchmark falha. O `--self-check` lê os dois a partir de `process.resourcesPath` e falha com a mensagem do caminho. Coberto no Task 1.
2. **Módulo nativo dentro do asar ou da plataforma errada:** `onnxruntime-node`, `node-llama-cpp` ou `sharp` não carregam no app instalado. O `--self-check` importa os três (só importa, não carrega modelo). Coberto no Task 1, e no CI do Windows no Task 2.
3. **Microfone negado no Mac:** o `ensureMic` devolve false e a tela já mostra a marcação manual (Plano 1). O pedido precisa aparecer na primeira gravação, com o texto em português. Verificação manual no roteiro do Task 2.
4. **Caminho com acento ou espaço** (`Inglês.app`, `C:\Users\João\AppData\…`): o app carrega o curso e grava o progresso. O `--self-check` roda no app desempacotado, cujo nome tem acento. O roteiro do Windows pede que se anote o nome do usuário do Windows.
5. **SmartScreen/Gatekeeper bloqueando o app não assinado:** o roteiro explica o clique certo com as palavras exatas da tela. Verificação manual no Task 2.

---

### Task 1: Configuração do pacote e self-check

**Files:**
- Create: `src/main/self-check.ts`, `tests/main/self-check.test.ts`
- Modify: `electron-builder.yml`, `build/entitlements.mac.plist`, `src/main/index.ts`, `src/main/ipc.ts` (só remover o comentário "Plan 3 adds benchmark.wav…" e usar o helper de caminhos), `package.json` (scripts)

**Interfaces:**
- Produces:
  - `resourcePaths(o: { packaged: boolean; resourcesPath: string; appPath: string }): { content: string; benchmarkWav: string }`, em `src/main/self-check.ts`. Empacotado → `<resourcesPath>/content` e `<resourcesPath>/benchmark.wav`; em dev → `<appPath>/content` e `<appPath>/resources/benchmark.wav`. O `ipc.ts` passa a usar esse helper.
  - `selfCheck(o: { content: string; benchmarkWav: string; importModule?: (name: string) => Promise<unknown> }): Promise<{ ok: boolean; lines: string[] }>`. Carrega o curso com `loadCourse`, lê e decodifica o `benchmarkWav` com `decodeWav` e importa `@huggingface/transformers`, `node-llama-cpp`, `phonemizer` e `sharp` (`importModule` padrão = `(n) => import(n)`). Cada passo vira uma linha `OK <passo>` ou `FALHOU <passo>: <mensagem>`, e `ok` é true se tudo passou.
  - `src/main/index.ts`: se `process.argv` tem `--self-check`, roda `selfCheck` antes de criar janela, escreve as linhas no stdout, chama `app.exit(ok ? 0 : 1)` e não registra IPC nem abre janela.
  - Scripts: `"build:mac": "npm run build && electron-builder --mac"`, `"build:win": "npm run build && electron-builder --win"`. Remover `build:linux`.

- [ ] **Step 1: Testes que falham** em `tests/main/self-check.test.ts`:
  - `resourcePaths` empacotado e em dev devolve os caminhos acima;
  - `selfCheck` com `content` apontando para `content/` do repo, `benchmarkWav` para `resources/benchmark.wav` e um `importModule` falso que resolve → `ok: true` e 6 linhas começando com `OK`;
  - `content` inexistente → `ok: false`, e uma linha começa com `FALHOU curso` e contém o caminho;
  - `importModule` que rejeita para `node-llama-cpp` → `ok: false`, uma linha `FALHOU node-llama-cpp: …`, e os outros passos rodam mesmo assim.
- [ ] **Step 2:** Rodar `npx vitest run tests/main/self-check.test.ts`. Esperado: FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `self-check.ts`, ligar no `index.ts` e no `ipc.ts`.
- [ ] **Step 4:** Reescrever o `electron-builder.yml` com os valores das Global Constraints:
  - `extraResources`: `content` → `content`, e `resources/benchmark.wav` → `benchmark.wav`;
  - `asarUnpack`: `**/*.node`, `node_modules/onnxruntime-node/**`, `node_modules/node-llama-cpp/**`, `node_modules/@node-llama-cpp/**`, `node_modules/sharp/**`, `node_modules/@img/**`;
  - em `mac.files` e `win.files`, excluir os `onnxruntime-node/bin/napi-v6/<outras plataformas>/**`;
  - em `win.files`, excluir `node_modules/@node-llama-cpp/*cuda*/**`;
  - `mac.target`: `dmg` com `arch: arm64`; `win.target`: `nsis` com `arch: x64`;
  - `nsis`: `oneClick: false`, `allowToChangeInstallationDirectory: true`, `createDesktopShortcut: always`;
  - `mac.extendInfo`: só a `NSMicrophoneUsageDescription` em português;
  - entitlements: `entitlements` e `entitlementsInherit` apontando para `build/entitlements.mac.plist`, com `com.apple.security.device.audio-input` acrescentado.
  Atualizar também o `setAppUserModelId` do `index.ts` para `br.ingles.app`.
- [ ] **Step 5:** Rodar `npm test`, `npm run typecheck` e `npm run lint`. Esperado: tudo passa.
- [ ] **Step 6:** Rodar `npm run build:mac`. Esperado:
  - existe `dist/Ingles-1.0.0-mac-arm64.dmg`;
  - `"dist/mac-arm64/Inglês.app/Contents/MacOS/Inglês" --self-check` imprime 6 linhas `OK` e sai com 0;
  - `codesign --verify "dist/mac-arm64/Inglês.app"` não dá erro (assinatura ad-hoc);
  - `plutil -p` no `Info.plist` mostra a descrição do microfone em português.
  Registrar no relatório o tamanho do DMG e do `.app`. Garantir que `dist/` está no `.gitignore`.
- [ ] **Step 7:** Commit `build: real app identity, bundled course and native modules, self-check mode`.

---

### Task 2: CI do Windows e do Mac, roteiro de teste e instruções de release

**Files:**
- Create: `.github/workflows/build.yml`, `docs/teste-windows.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: `npm run build:win`, `npm run build:mac`, o modo `--self-check` e os nomes de artefato do Task 1.

- [ ] **Step 1:** Escrever o `.github/workflows/build.yml`:
  - roda com `workflow_dispatch` e com push de tag `v*`;
  - matriz com `windows-latest` (`build:win`) e `macos-latest` (`build:mac`);
  - Node 22, com `npm ci` e depois `npm test`;
  - depois do build, roda o self-check no app desempacotado:
    - Windows: `& "dist/win-unpacked/Ingles.exe" --self-check` no PowerShell, falhando se `$LASTEXITCODE` não for 0;
    - Mac: o mesmo comando do Task 1;
  - mostra o tamanho do instalador no log;
  - publica `dist/*.exe` e `dist/*.dmg` com `actions/upload-artifact@v4`;
  - com tag, cria um release em rascunho com os dois arquivos, via `softprops/action-gh-release@v2` e `draft: true`.
  `GH_TOKEN` não é necessário para o electron-builder, porque o `publish` foi removido.
- [ ] **Step 2:** Validar o YAML localmente. Se tiver o `actionlint` (`npx --yes actionlint` ou o binário), rodar e esperar zero erros. Se não tiver, rodar `node -e "require('yaml')"` ou `npx --yes js-yaml .github/workflows/build.yml` e conferir os campos na mão. Dizer no relatório qual foi usado.
- [ ] **Step 3:** Escrever `docs/teste-windows.md`, em português, para quem vai testar no notebook Windows (i5, vídeo integrado, 16 GB). Passos numerados com o resultado esperado e um campo "o que aconteceu" para anotar:
  1. baixar o `.exe` do release (link que o usuário vai mandar);
  2. passar pelo SmartScreen: "O Windows protegeu o computador" → "Mais informações" → "Executar assim mesmo";
  3. instalar e abrir pelo atalho da área de trabalho;
  4. na tela "Preparar a IA", anotar o pacote recomendado e o hardware mostrado; tocar em "Baixar e preparar" e anotar quanto tempo levou;
  5. criar um perfil e fazer uma sessão solo de 10 min: gravar um exercício "repeat" (o Windows pode pedir o microfone; anotar se pediu), anotar se a nota de pronúncia apareceu e quantos segundos a correção demorou;
  6. responder um exercício de fala livre e anotar quanto tempo levou o "Analisando sua resposta…" e se o feedback veio em português;
  7. fazer uma sessão guiada curta e conferir que nada da IA aparece;
  8. fechar e abrir de novo: o progresso continua e a IA não baixa de novo;
  9. desligar o Wi-Fi e abrir: tudo funciona.
  No fim, uma seção "Se algo der errado": a pasta de dados (`%APPDATA%\Inglês`), o que mandar de volta (print, nome do usuário do Windows, tempos anotados) e como abrir o self-check: `"C:\Program Files\Inglês\Ingles.exe" --self-check` no PowerShell.
- [ ] **Step 4:** No `README.md`, acrescentar uma seção "Gerar os instaladores", em português, com:
  - `npm run build:mac` local;
  - o Windows via Actions: criar o repositório no GitHub, `git push`, `git tag v1.0.0 && git push --tags`, pegar o rascunho do release e publicar;
  - o link para `docs/teste-windows.md`.
- [ ] **Step 5:** Rodar `npm test` e `npm run lint`. Esperado: passam.
- [ ] **Step 6:** Commit `ci: Windows and Mac installers via GitHub Actions, Windows test script`.
