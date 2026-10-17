# Plano 7 — Versão Android (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar um APK Android do app. Ele reaproveita as telas React e `src/shared/`, roda o reconhecimento de fala e a pronúncia no próprio celular e roda a IA de conversa livre (Qwen3.5 2B) só em celular que aguenta. O APK sai pelo CI e vai para a página de releases.

**Architecture:**
- **Empacotamento:** um app Capacitor (`android/`) carrega um build web próprio (`out/mobile/`) feito com Vite a partir de `src/renderer/` e de uma entrada nova, `src/mobile/`.
- **`window.api`:** no Android, `createMobileApi()` implementa a mesma interface `AppApi` do Electron.
  - Arquivos: `@capacitor/filesystem`.
  - Whisper e wav2vec2: transformers.js (onnxruntime-web, em WebAssembly) dentro de um Web Worker.
  - Qwen: llama.cpp nativo, por um plugin Capacitor.
- **Código compartilhado:** o código puro que hoje está em `src/main/` e serve aos dois lados vai para `src/shared/`:
  - fonemas;
  - prompt e parse da correção livre;
  - prompt do Whisper;
  - parse do curso;
  - estado e amostras.

**Tech Stack:**
- Capacitor, versão estável atual (≥ 7). Plugins: `@capacitor/android`, `@capacitor/filesystem`, `@capacitor/file-transfer`, `@capacitor/share`, `@capacitor/app`.
- Plugin de llama.cpp: escolhido na Task 1.
- Já no projeto: Vite, `@huggingface/transformers` 4.3.1 (build web), `phonemizer`, zod e Vitest.
- Toolchain: JDK 21 e Android SDK (platform 35, build-tools).

**Spec:** `docs/superpowers/specs/2026-10-15-app-ingles-design.md`, mais o pedido do usuário em 2026-10-16:
- "é possível gerar um apk pra android?";
- "e a parte da ia roda no celular?";
- "roda o writing-plans pro android então".

A recomendação aceita foi:
- pacote leve, com llama.cpp nativo;
- o app mede o celular no primeiro uso;
- celular fraco fica sem a correção da fala livre e cai na marcação manual.

## Global Constraints

- **Plataforma:** Android só arm64 (`arm64-v8a`). `minSdkVersion` é o padrão do Capacitor.
- **Nome e pacote:**
  - `appName` "Inglês";
  - `appId` `io.github.yagoramires.ingles`;
  - APK de release `Ingles-<versão>-android.apk`.
- **`versionName`** = `version` do `package.json`. **`versionCode`** = `major*10000 + minor*100 + patch`.
- **Modelos no Android:**
  - Whisper: só o `STT_BASE` (`onnx-community/whisper-base.en`, q8). Nunca o small.
  - Pronúncia: `PRON_MODEL`.
  - LLM: só `LLM_BY_TIER.light` (`Qwen3.5-2B-Q4_K_M.gguf`, 1281 MB, conferência de tamanho ±1%).
- **Regra do celular** (`chooseMobileSetup`):
  - `pronunciation = pronunciationEnabled(rtf)` (rtf ≤ 1.0);
  - `llm = hw.totalMemGB >= 6 && rtf <= 1.5`.
  - `shortcut: 6 GB e rtf 1.5 são palpites; recalibrar com os logs do primeiro celular real.`
- **Correção livre no celular:**
  - timeout `MOBILE_FREE_SPEAK_TIMEOUT_MS = 90_000`;
  - `contextSize` 2048, `maxTokens` 300, `temperature` 0, `seed` 1;
  - thinking desligado;
  - JSON restrito por gramática (o mesmo `SCHEMA` do desktop);
  - uma geração por vez.
- **Offline depois do setup:**
  - os `.wasm` do onnxruntime-web vão dentro do APK (`env.backends.onnx.wasm.wasmPaths = './ort/'`), nunca do CDN;
  - os modelos ficam no Cache API (`env.useBrowserCache = true`);
  - o app pede `navigator.storage.persist()` no setup.
- **Privacidade:** igual ao desktop.
  - Amostras de voz são opt-in, desligadas por padrão.
  - Transcrição e áudio nunca vão para o log.
- **Textos da interface:** em pt-BR, no tom das telas atuais.
- **Desktop:** nada muda para quem usa o desktop. Os 228 testes atuais continuam passando, e o self-check do Windows no CI continua passando.
- **Assinatura:** o APK de release é assinado com uma keystore fixa, guardada nos secrets do GitHub. Sem keystore fixa, uma atualização não instala por cima da anterior.

## Review Focus

1. **Modo avião depois do setup:** a fala, a pronúncia e a correção livre continuam funcionando. Um teste da Task 4 confere que `out/mobile/ort/` tem os `.wasm`. O checklist manual da Task 8 testa em modo avião.
2. **App fechado ou morto no meio do download de 1,3 GB:** ao reabrir, a IA aparece como "não preparada" e "Tentar de novo" baixa do zero, sem tratar um arquivo pela metade como pronto. Teste na Task 6: `.part` com tamanho errado → apagado e `ready.llm=false`.
3. **Celular com menos de 6 GB de RAM:** não baixa o Qwen, e a fala livre cai na marcação manual (`evaluateFreeSpeak` → `no-model`). Testes na Task 5 (`chooseMobileSetup`) e na Task 6.
4. **Botão "voltar" do Android no meio de uma aula:** o app não fecha direto. Pergunta "Sair do app? O que não foi salvo se perde." e só sai se a pessoa confirmar. Implementado na Task 3 e conferido no checklist da Task 8.
5. **Permissão do microfone negada:** `ensureMic()` devolve `false` e aparece a mensagem de microfone que já existe (`MIC_ERROR`), sem travar. Teste na Task 4.

---

### Task 1: Toolchain Android e prova do llama.cpp (go/no-go)

Esta task decide o plugin do LLM. Nada do app muda nela.

**Files:**
- Create: `docs/android-llama-spike.md` (resultado da prova)

**Interfaces:**
- Produces: a escolha do plugin e este contrato, que a Task 6 implementa por cima dele:
  ```ts
  /** src/mobile/llm-native.ts */
  export interface NativeLlm {
    load(modelPath: string): Promise<void> // file:// ou caminho absoluto
    complete(o: { prompt: string; grammar: string; maxTokens: number; temperature: number; seed: number }): Promise<string>
    stop(): Promise<void> // interrompe a geração em curso
    release(): Promise<void>
  }
  ```

- [ ] **Step 1: Instalar o toolchain**
  - `brew install --cask android-commandlinetools` e `brew install openjdk@21`.
  - Depois: `sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0" "emulator" "system-images;android-35;google_apis;arm64-v8a"`.
  - Criar um AVD arm64 com 8 GB de RAM.
  - Esperado: `adb devices` lista o emulador.
- [ ] **Step 2: Provar o plugin `llama-cpp-capacitor`** num app Capacitor descartável no scratchpad:
  - carregar o `Qwen3.5-2B-Q4_K_M.gguf` (copiado com `adb push`);
  - gerar com uma gramática GBNF de JSON.
  - **Passa se:** o modelo carrega (a arquitetura Qwen3.5 precisa de um llama.cpp recente), a saída é JSON válido nas três chaves e há como interromper.
- [ ] **Step 3: Se o Step 2 falhar,** provar um plugin próprio, mínimo:
  - `android/llama/`, com llama.cpp como submódulo no mesmo commit que o `node-llama-cpp` 3.22.1 usa;
  - JNI com `load`, `complete` (prompt, gramática GBNF, maxTokens, temp, seed) e `stop`/`free`;
  - CMake só para `arm64-v8a`.
  - O critério é o mesmo do Step 2.
- [ ] **Step 4: Registrar em `docs/android-llama-spike.md`:**
  - o plugin escolhido e a versão;
  - tokens/s no emulador;
  - o tempo de uma correção típica;
  - o tamanho que o `.so` acrescenta ao APK.
- [ ] **Step 5: Commit**
  ```bash
  git add docs/android-llama-spike.md && git commit -m "docs: Android llama.cpp spike result"
  ```
  **Se nenhum caminho passar:** parar e avisar o usuário. As Tasks 2–5 e 7–8 ainda entregam o APK sem a correção livre, e a Task 6 fica de fora.

### Task 2: Extrair o código portátil para `src/shared/`

Esta task é refatoração pura. O desktop continua igual.

**Files:**
- Move (`git mv`): `src/main/ai/phonemes.ts` → `src/shared/ai/phonemes.ts`
- Create:
  - `src/shared/ai/freeSpeak.ts`: `SCHEMA`, `buildPrompt` e `parseEval` saem de `src/main/ai/freeSpeak.ts`.
  - `src/shared/ai/whisper.ts`: `cleanTranscript` e o miolo de `load()` de `src/main/ai/stt.ts`.
  - `src/shared/course-source.ts`: o parse que hoje está em `src/main/content/load-course.ts`.
  - `src/shared/state.ts`: `emptyState` e `isState` saem de `src/main/store.ts`.
  - `src/shared/samples.ts`: o nome do `.wav` e a linha do jsonl, de `src/main/samples.ts`.
- Modify: os arquivos de origem passam a importar dos novos.
- Test: atualizar os imports de `tests/main/{phonemes,freeSpeak,stt,load-course,store,samples}.test.ts`. Os testes puros vão para `tests/shared/`.

**Interfaces:**
- Produces:
  ```ts
  // src/shared/ai/whisper.ts — o chamador configura `env` do transformers antes
  export function cleanTranscript(text: string): string
  export function loadWhisper(repo: string): Promise<{ run(audio: Float32Array, prompt?: string): Promise<string>; dispose(): Promise<void> }>
  // src/shared/course-source.ts
  export class ContentError extends Error {}
  export type CourseSource = {
    unitFiles(): Promise<string[]>                  // nomes em units/, ex. "a1-01.json"
    read(path: string): Promise<string | undefined> // relativo ao content/; undefined = não existe
    exists?(path: string): Promise<boolean>         // sem ele, a checagem dos .mp3 é pulada
  }
  export function parseCourse(src: CourseSource): Promise<Course>
  // src/shared/state.ts
  export const emptyState: () => AppState
  export function isState(v: unknown): v is AppState
  // src/shared/samples.ts
  export function sampleEntry(s: Sample, at: Date): { file: string; line: Omit<Sample, 'wav'> & { at: string; wav: string } }
  ```
  `src/main/content/load-course.ts` passa a ser `loadCourse(dir)` = `parseCourse(fsSource(dir))` e reexporta `ContentError`. Assim os chamadores atuais (ipc, self-check, testes) não mudam.

- [ ] **Step 1:** Escrever `tests/shared/course-source.test.ts` com uma `CourseSource` em memória:
  - um curso mínimo válido passa;
  - `read('units/x.json')` devolvendo `undefined` para um arquivo listado → `ContentError` com `units/x.json` na mensagem, ou só `x.json`, como a mensagem atual;
  - sem `exists`, um `audio/index.json` que aponta para um mp3 inexistente **não** falha.
- [ ] **Step 2:** Rodar `npx vitest run tests/shared/course-source.test.ts`. Esperado: FAIL (o módulo não existe).
- [ ] **Step 3:** Fazer as extrações. A desktop `loadCourse` passa um `exists` com `fs.access`, para manter a checagem dos mp3. `sampleEntry` mantém o formato de nome atual: `<ISO com : e . trocados por ->-<exerciseId saneado>.wav`.
- [ ] **Step 4:** Rodar `npm test && npm run typecheck`. Esperado: tudo verde, e os mesmos testes de antes continuam passando.
- [ ] **Step 5:** Commit `refactor: move platform-free AI, course and state code to src/shared`.

### Task 3: Ganchos de plataforma nas telas

**Files:**
- Modify:
  - `src/shared/api.ts`: `AppApi` ganha `platform` e `audioUrl`.
  - `src/preload/index.ts`
  - `src/renderer/src/components/ListenButton.tsx`
  - `src/renderer/src/audio/speak.ts`
  - `src/renderer/src/flow.ts` (`describeHardware`)
  - `src/renderer/src/screens/SetupScreen.tsx`
- Test: `tests/renderer/flow.test.ts` (já existe; acrescentar casos) e `tests/renderer/speak.test.ts`

**Interfaces:**
- Produces, em `AppApi`:
  ```ts
  readonly platform: 'desktop' | 'android'
  /** URL tocável de um mp3 do curso; desktop: `course-audio://audio/<file>` */
  audioUrl(file: string): string
  ```

- [ ] **Step 1:** Escrever os testes:
  - `describeHardware({...hw, platform: 'android'})` não contém a linha "Placa de vídeo dedicada";
  - com `platform: 'win32'` a linha continua;
  - `speak('hi')` sem `window.speechSynthesis` não lança exceção. O WebView do Android não tem esse recurso.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar:
  - **Preload:** `platform: 'desktop'` e `audioUrl` com o esquema atual.
  - **`ListenButton`:** usa `window.api.audioUrl(file)`.
  - **`speak`:** retorna cedo sem `speechSynthesis`.
  - **`SetupScreen` com `window.api.platform === 'android'`:**
    - esconde "Escolher outro pacote" e "Abrir amostras";
    - o botão de logs diz "Enviar logs".
- [ ] **Step 4:** Rodar `npm test && npm run typecheck`. Esperado: PASS. Abrir o app desktop (`npm run dev`) e conferir que o áudio de um exercício toca.
- [ ] **Step 5:** Commit `feat: platform hooks in AppApi for a second shell`.

### Task 4: Casca Capacitor que abre o curso

O APK abre, mostra os perfis, carrega o curso, toca os áudios e grava a voz. A IA ainda aparece como "não preparada".

**Files:**
- Create:
  - `capacitor.config.ts`: `appId`, `appName`, `webDir: 'out/mobile'`.
  - `vite.mobile.config.ts`: root `src/renderer`, entrada `mobile.html`, saída `out/mobile`, alias `@renderer`, plugin react.
  - `src/renderer/mobile.html`: mesmo `<div id="root">`. A CSP tem:
    - `script-src 'self' 'wasm-unsafe-eval'`;
    - `worker-src 'self' blob:`;
    - `connect-src 'self' https:`;
    - `media-src 'self'`.
  - `src/mobile/main.ts`: `window.api = createMobileApi()`, depois `await import('../renderer/src/main')`. Registra o botão voltar (Review Focus 4) com `@capacitor/app`: `confirm` e depois `App.exitApp()`.
  - `src/mobile/fs.ts`: interface `TextFs` e `createCapacitorFs()` (`Directory.Data`).
  - `src/mobile/api.ts`: `createMobileApi(deps?)`.
  - `scripts/copy-mobile-assets.mjs`:
    - copia `content/` → `out/mobile/content/`;
    - grava `out/mobile/content/units/index.json` com a lista ordenada de unidades;
    - copia `resources/benchmark.wav` → `out/mobile/benchmark.wav`;
    - copia `node_modules/onnxruntime-web/dist/*.{wasm,mjs}` → `out/mobile/ort/`.
  - `android/`: gerado por `npx cap add android`. No `AndroidManifest.xml` entram `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` e `INTERNET`, e `abiFilters 'arm64-v8a'`.
  - `tests/mobile/api.test.ts` e `tests/mobile/assets.test.ts`
- Modify:
  - `package.json`: dependências do Capacitor e os scripts abaixo.
  - `.gitignore`: `out/`, `android/app/build`, `android/.gradle`.
  - `tsconfig.web.json`: incluir `src/mobile/**/*`.

**Scripts:**
- `"build:mobile": "vite build -c vite.mobile.config.ts && node scripts/copy-mobile-assets.mjs"`
- `"build:android": "npm run build:mobile && cap sync android && cd android && ./gradlew assembleRelease"`
- `"android:dev": "npm run build:mobile && cap run android"`

**Interfaces:**
- Produces:
  ```ts
  export type TextFs = {
    read(path: string): Promise<string | undefined>     // undefined = não existe
    write(path: string, data: string): Promise<void>    // cria as pastas
    append(path: string, data: string): Promise<void>
    writeBytes(path: string, data: Uint8Array): Promise<void>
    rename(from: string, to: string): Promise<void>
    remove(path: string): Promise<void>                 // arquivo ou pasta; ausente não é erro
    size(path: string): Promise<number | undefined>
    uri(path: string): Promise<string>                  // file:// para código nativo e Share
  }
  export function createMobileApi(deps?: Partial<{ fs: TextFs; fetch: typeof fetch; getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream> }>): AppApi
  ```
- **O que fica de fora nesta task:** `loadState` devolve `emptyState()`. As funções de IA devolvem `no-model` ou status vazio. As demais são no-op. As Tasks 5 e 6 preenchem tudo.
- **Já na Task 4:**
  - `platform: 'android'`;
  - `audioUrl(f) = 'content/audio/' + f`;
  - `loadCourse` = `parseCourse` sobre `fetch('content/...')`, sem `exists`;
  - `ensureMic`.

- [ ] **Step 1:** Escrever os testes:
  - `ensureMic()` devolve `false` quando `getUserMedia` rejeita (Review Focus 5);
  - com sucesso, devolve `true` e para as tracks;
  - `loadCourse()` com um `fetch` fake sobre o `tests/fixtures` monta o curso;
  - `assets.test.ts` (pulado se `out/mobile` não existe): `out/mobile/ort/` tem pelo menos um `.wasm` e `out/mobile/content/units/index.json` lista 60 unidades.
- [ ] **Step 2:** Rodar `npx vitest run tests/mobile`. Esperado: FAIL.
- [ ] **Step 3:** Implementar e gerar o projeto `android/`.
- [ ] **Step 4:** Rodar `npm run build:mobile && npx vitest run tests/mobile`. Esperado: PASS. Depois, `npm run android:dev` no emulador:
  - criar um perfil;
  - abrir uma aula;
  - o botão de ouvir toca o mp3;
  - gravar pede a permissão do microfone;
  - o "voltar" pergunta antes de sair.
- [ ] **Step 5:** Commit `feat: Capacitor Android shell that loads the course`.

### Task 5: Dados, log e amostras no celular

**Files:**
- Create:
  - `src/mobile/store.ts`: `createMobileStore(fs)` com a mesma semântica do `src/main/store.ts`:
    - `state.json`;
    - JSON inválido vai para `state.corrupt-<ms>.json` e devolve `recoveredFrom`;
    - escrita atômica por `.tmp` + rename;
    - fila de escritas.
  - `src/mobile/samples.ts`: `createMobileSamples(fs)` com `settings.json` e `amostras/`, usando `sampleEntry`.
  - `src/mobile/log.ts`: `initMobileLog(fs): string`:
    - `logs/main.log`;
    - o anterior vira `main.old.log`;
    - cópia de `console.*` com fila de `append`;
    - nunca lança exceção.
  - `src/mobile/tier.ts`: `chooseMobileSetup`.
  - `tests/mobile/{store,samples,log,tier}.test.ts`, com um `TextFs` em memória (`tests/mobile/memfs.ts`)
- Modify: `src/mobile/api.ts`, que passa a ligar:
  - `loadState`, `createProfile`, `saveProgress` (com as mesmas validações do `ipc.ts`);
  - `getSettings`, `setSaveSamples`, `saveSample`, `deleteSamples`;
  - `openLogs`: `@capacitor/share` com o `uri` do `main.log`.

**Interfaces:**
- Produces:
  ```ts
  export function chooseMobileSetup(hw: Hardware, rtf: number): { pronunciation: boolean; llm: boolean }
  ```

- [ ] **Step 1:** Escrever os testes:
  - store: os mesmos cenários de `tests/main/store.test.ts` (ausente → vazio, corrompido → backup + `recoveredFrom`, duas gravações seguidas → a última vence);
  - samples: desligado → `save` não grava nada; ligado → `.wav` + linha no jsonl; `remove` apaga a pasta;
  - log: `console.info('x')` acaba em `logs/main.log`; o arquivo anterior vira `main.old.log`; `fs.append` que rejeita não derruba o app;
  - tier:
    - `({totalMemGB: 8}, 1.2)` → `{pronunciation: false, llm: true}`;
    - `({totalMemGB: 4}, 0.5)` → `{pronunciation: true, llm: false}`;
    - `({totalMemGB: 8}, 0.9)` → `{pronunciation: true, llm: true}`;
    - `({totalMemGB: 6}, 1.6)` → `llm: false`.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar `npm test`. Esperado: PASS. No emulador, conferir três coisas:
  - o progresso sobrevive a fechar e reabrir o app;
  - "Enviar logs" abre o menu de compartilhar do Android;
  - **Prova de privacidade:** o log não tem nenhum texto falado.
- [ ] **Step 5:** Commit `feat: Android storage, logs and voice samples`.

### Task 6: IA no celular (fala, pronúncia e correção livre)

**Files:**
- Create:
  - `src/mobile/ai.worker.ts`. Roda transformers.js com:
    - `env.allowLocalModels = false`;
    - `env.useBrowserCache = true`;
    - `env.backends.onnx.wasm.wasmPaths = './ort/'`.
    - Mensagens: `transcribe`, `score`, `download` (com progresso), `benchmark`, `dispose`.
    - Usa `loadWhisper` e os fonemas de `src/shared/ai/`. O `vocab.json` do wav2vec2 vai para o Cache API com o modelo.
  - `src/mobile/ai-client.ts`: RPC mínimo sobre `postMessage` (id → promise), com progresso por callback.
  - `src/mobile/llm-native.ts`: `NativeLlm` sobre o plugin da Task 1. Também:
    - `qwenPrompt(user: string): string` (ChatML com thinking desligado: `<|im_start|>assistant\n<think>\n\n</think>\n\n`);
    - `FREE_SPEAK_GBNF`, a gramática do `SCHEMA` escrita à mão.
  - `src/mobile/setup.ts`: `createMobileSetup(deps)`, que implementa `aiStatus` e `setupAi`. O estado fica em `models/ai-state.json`. Os passos:
    1. `navigator.storage.persist()`;
    2. baixar o Whisper base;
    3. medir com `benchmark.wav` (rtf calculado como no desktop: um aquecimento e depois uma medição);
    4. `chooseMobileSetup`;
    5. baixar a pronúncia, se couber;
    6. baixar o GGUF, se `llm`, com `@capacitor/file-transfer` para `models/<arquivo>.part`. O tamanho é conferido (±1%) e o arquivo é renomeado. Se o tamanho estiver errado, o `.part` é apagado e o passo falha;
    7. gravar o estado.
    - `tier` é sempre `'light'` depois do setup.
    - `ready.llm` só vale `true` com o estado gravado **e** o `.gguf` presente.
  - Hardware: `Hardware` com `platform: 'android'`, `totalMemGB` (`toGB` da RAM total), `cores` e `cpuModel`, e `hasDiscreteGpu: false`.
    - A RAM vem do plugin da Task 1, se ele expuser; senão, de um plugin local de 1 método (`DeviceInfo.totalMem()`, `ActivityManager.MemoryInfo`) em `android/app/src/main/java/.../DeviceInfoPlugin.kt`.
  - `tests/mobile/setup.test.ts`, `tests/mobile/llm.test.ts`
- Modify: `src/mobile/api.ts`, que passa a ligar:
  - `transcribe`, com a mesma regra do `ipc.ts`: prompt = `expected ?? hint`; a pronúncia só roda com `expected` e `pronunciationEnabled`; falha na pronúncia não derruba a transcrição;
  - `evaluateFreeSpeak`;
  - `aiStatus`, `setupAi` e `onAiProgress`.

**Interfaces:**
- Consumes: `NativeLlm` (Task 1), `chooseMobileSetup` (Task 5), `loadWhisper`/`cleanTranscript`/`buildPrompt`/`parseEval` (Task 2).
- Produces:
  ```ts
  export const MOBILE_FREE_SPEAK_TIMEOUT_MS = 90_000
  export function createMobileFreeSpeak(llm: NativeLlm, modelPath: () => Promise<string | null>): {
    evaluate(input: FreeSpeakInput): Promise<FreeSpeakEval>; dispose(): Promise<void>
  }
  ```

- [ ] **Step 1:** Escrever os testes, com `NativeLlm` e downloads fake:
  - `modelPath()` → `null` ⇒ `{ok: false, reason: 'no-model'}` (Review Focus 3);
  - `complete` que demora mais que o timeout (`vi.useFakeTimers`) ⇒ `reason: 'timeout'` e `stop()` chamado;
  - duas chamadas ao mesmo tempo ⇒ `complete` nunca roda em paralelo;
  - `complete` devolvendo `'"correct":true,"feedback_pt":"Boa!","corrected_en":"Hi"}'` ⇒ `ok: true` (o `parseEval` repõe o `{`);
  - setup com o GGUF `.part` de tamanho errado ⇒ `.part` removido, progresso `error`, `ready.llm === false` (Review Focus 2);
  - setup com 4 GB ⇒ o downloader do GGUF nunca é chamado e `aiStatus().ready.llm === false`;
  - setup bem-sucedido ⇒ fases na ordem `stt`, `benchmark`, `pronunciation`, `llm`, `done`.
- [ ] **Step 2:** Rodar `npx vitest run tests/mobile`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. O worker não tem teste unitário; ele é conferido no Step 4.
- [ ] **Step 4:** No emulador:
  - preparar a IA;
  - o log mostra o rtf, a RAM e a decisão `llm`;
  - responder a um exercício falado e ver a transcrição;
  - responder a uma fala livre e ver a correção;
  - ligar o **modo avião** e repetir as duas coisas (Review Focus 1).
- [ ] **Step 5:** Commit `feat: on-device speech, pronunciation and free-speak on Android`.

### Task 7: APK assinado no CI e nas releases

**Files:**
- Modify:
  - `android/app/build.gradle`:
    - `versionName`/`versionCode` lidos do `../../package.json` (JsonSlurper; regra em Global Constraints);
    - `signingConfigs.release` lido das variáveis `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`;
    - sem essas variáveis, o release usa a assinatura debug, só para build local.
  - `.github/workflows/build.yml`. Novo job `android` em `ubuntu-latest`, em todo push na `main`, nas tags e no manual:
    - `setup-node` 22 e `setup-java` 21 (temurin);
    - `npm ci`, `npm test`;
    - decodifica `secrets.ANDROID_KEYSTORE_B64` para um arquivo temporário;
    - `npm run build:android`;
    - renomeia para `Ingles-<versão>-android.apk`;
    - `upload-artifact` com o nome `installer-Android`.
    - O job `release` passa a ter `needs: [build, android]` e `files` inclui `installers/*.apk`.
  - `README.md`: seção "Android", com como instalar o APK (permitir "fontes desconhecidas") e o aviso de que a IA de conversa precisa de 6 GB de RAM.

- [ ] **Step 1:** Gerar a keystore:
  - `keytool -genkeypair -v -keystore ~/ingles-release.jks -alias ingles -keyalg RSA -keysize 2048 -validity 10000`, com as senhas definidas pelo usuário.
  - **Pedir confirmação ao usuário antes** de gravar os secrets com `gh secret set` (`ANDROID_KEYSTORE_B64` via `base64 -i ~/ingles-release.jks`, mais as três senhas e o alias).
  - Avisar que ele precisa guardar um backup da `.jks`. Sem ela, nenhuma atualização instala por cima.
- [ ] **Step 2:** Rodar `npm run build:android` localmente. Esperado: `android/app/build/outputs/apk/release/app-release.apk` e `apksigner verify --print-certs` mostra o certificado.
- [ ] **Step 3:** Push na `main`. Esperado: o job `android` fica verde e o artifact `installer-Android` traz o APK. Anotar o tamanho no log do passo.
- [ ] **Step 4:** Commit `ci: build a signed Android APK and attach it to releases`. O push do Step 3 acontece depois deste commit.

### Task 8: Checklist de teste em celular real

**Files:**
- Create: `docs/teste-android.md`, no estilo do `docs/teste-windows.md`.

O checklist cobre:
- instalar o APK do artifact;
- conceder o microfone;
- nivelamento;
- uma aula inteira;
- preparar a IA, anotando RAM, rtf, decisão `llm` e tempo de uma correção (tudo isso aparece em "Enviar logs");
- modo avião (Review Focus 1);
- fechar o app no meio do download e reabrir (Review Focus 2);
- "voltar" no meio da aula (Review Focus 4);
- negar o microfone (Review Focus 5);
- instalar o APK de uma versão seguinte por cima sem perder o progresso.

- [ ] **Step 1:** Escrever o checklist.
- [ ] **Step 2:** Commit `docs: Android device test checklist`.
