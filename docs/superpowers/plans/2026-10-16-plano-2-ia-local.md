# Plano 2 — IA local completa (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o atalho do `whisper-cli` por uma IA local completa e embutida no app: transcrição (Whisper via transformers.js), avaliação de pronúncia (wav2vec2 de fonemas + eSpeak em WASM), correção de respostas livres (LLM pequeno via node-llama-cpp), escolha automática de pacote pelo hardware e download dos modelos no primeiro uso, com barra de progresso.

**Architecture:** Tudo roda no processo main. Os modelos ficam em `app.getPath('userData')/models`. A lógica pura (escolha de pacote, decodificação CTC, alinhamento de fonemas, prompt e parse do LLM, leitura de WAV) fica em `src/shared/` ou em funções puras do main, com testes. Os wrappers de modelo são finos e têm testes de integração que são pulados quando o modelo não está baixado. O renderer ganha uma tela de preparação e mostra o feedback de pronúncia e de resposta livre.

**Tech Stack:** `@huggingface/transformers@4.3.1` (onnxruntime-node), `node-llama-cpp@3.22.1`, `phonemizer@1.2.1`. As pesquisas e medições estão em `.superpowers/research-plan2.md` (fora do git; os valores necessários estão copiados abaixo).

**Spec:** `docs/superpowers/specs/2026-10-15-app-ingles-design.md`

## Global Constraints

- **O modo guiado continua sem IA:** nada deste plano roda nele.
- **Rede:** só no download único dos modelos, iniciado pela tela de preparação. Depois disso tudo funciona offline (`env.allowRemoteModels = false` no uso normal).
- **Falhas de IA:** se um modelo faltar ou falhar, o app continua funcionando. Mostra a mensagem em português e oferece a marcação manual, que já existe. Nunca trava nem perde progresso.
- **Pronúncia é só orientação:** ela **não muda o veredito**. O veredito continua vindo da comparação de texto ("na dúvida, aceitar").
- **Textos de interface e explicações:** em português (pt-BR).
- **Modelos** (URLs no padrão `https://huggingface.co/<repo>/resolve/main/<arquivo>`):
  - STT (todos os pacotes): `onnx-community/whisper-base.en`, `dtype: 'q8'` (~77 MB);
  - pronúncia (todos os pacotes, a menos que seja desligada): `onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX`, arquivo `onnx/model_quantized.onnx` (~318 MB), com `vocab.json` e `preprocessor_config.json`;
  - LLM leve: `unsloth/Qwen3.5-2B-GGUF` / `Qwen3.5-2B-Q4_K_M.gguf` (1281 MB);
  - LLM médio: `unsloth/Qwen3.5-4B-GGUF` / `Qwen3.5-4B-Q4_K_M.gguf` (2741 MB);
  - LLM forte: `unsloth/Qwen3.5-9B-GGUF` / `Qwen3.5-9B-Q4_K_M.gguf` (5681 MB).
- **Regra de pacote** (`chooseTier`):
  - Mac arm64 com 16 GB ou mais → `strong`; Mac arm64 com menos → `medium`;
  - menos de 12 GB de RAM → `light`;
  - 16 GB ou mais e `rtf <= 0.6` (ou GPU dedicada) → `medium`;
  - todo o resto → `light`;
  - `rtf` é o tempo do Whisper base no clipe de benchmark dividido pela duração do clipe;
  - a pronúncia é desligada quando `rtf > 1.0`.
- **Externals:** `@huggingface/transformers`, `onnxruntime-node`, `node-llama-cpp`, `@node-llama-cpp/*`, `phonemizer` e `sharp` ficam fora do bundle do main (são carregados de `node_modules`).

## Review Focus

1. **Download interrompido** (sem internet, app fechado no meio): ao reabrir, o app retoma ou refaz o download sem considerar pronto um arquivo pela metade. Os arquivos são baixados como `.part` e renomeados; o estado "pronto" só é gravado no fim. Testes no Task 5.
2. **LLM devolve JSON inválido, texto em inglês ou demora demais:** cai na autoavaliação com checklist, que já existe, com a mensagem em português. Há timeout de 60 s. Testes no Task 4.
3. **Áudio vazio, curto demais ou só ruído na pronúncia:** devolve "sem avaliação" em vez de nota 0 ou erro. Testes no Task 3.
4. **Texto esperado com números, contrações ou pontuação** ("I'm 25!"): a pronúncia fonemiza a forma que se fala. Testes no Task 3.
5. **Troca de pacote nas configurações para um maior que a máquina aguenta:** aparece o aviso, e o modelo antigo só é apagado depois que o novo estiver pronto. Testes no Task 5.

---

### Task 1: Dependências, detecção de hardware e escolha de pacote

**Files:**
- Modify: `package.json` (deps), `electron.vite.config.ts` (externals)
- Create: `src/main/ai/tiers.ts`, `src/main/ai/hardware.ts`
- Test: `tests/main/tiers.test.ts`

**Interfaces:**
- Produces:

```ts
// src/shared/api.ts (o renderer precisa destes tipos)
export type Tier = 'light' | 'medium' | 'strong'
export type Hardware = { platform: string; arch: string; totalMemGB: number; cpuModel: string; cores: number; hasDiscreteGpu: boolean }
// tiers.ts (importa Tier e Hardware de ../../shared/api)
export type ModelFile = { repo: string; file: string; bytes: number }
export const STT_MODEL = 'onnx-community/whisper-base.en'
export const PRON_MODEL = 'onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX'
export const LLM_BY_TIER: Record<Tier, ModelFile>   // valores das Global Constraints (bytes = MB * 1024 * 1024, arredondado)
export function chooseTier(hw: Hardware, rtf: number | null): Tier   // rtf null = ainda sem benchmark → trata como 1.0
export function pronunciationEnabled(rtf: number | null): boolean      // false só se rtf > 1.0
// hardware.ts
export function detectHardware(): Promise<Hardware>   // os.totalmem/cpus, process.arch, app.getGPUInfo('basic'); GPU dedicada = vendorId NVIDIA 4318 ou AMD 4098 ativo
```

- [ ] **Step 1:** `npm install @huggingface/transformers@4.3.1 node-llama-cpp@3.22.1 phonemizer@1.2.1`. Em `electron.vite.config.ts`, colocar esses pacotes e mais `onnxruntime-node`, `sharp` e `@node-llama-cpp/*` em `build.rollupOptions.external` do main (ou usar o `externalizeDepsPlugin` do template, conferindo se ele já os cobre).
- [ ] **Step 2: Testes que falham**, cobrindo todos os ramos da regra:
  - Mac arm64 com 16 GB → strong; Mac arm64 com 8 GB → medium;
  - Windows com 8 GB → light;
  - Windows com 16 GB e rtf 0.5 → medium; Windows com 16 GB e rtf 0.9 → light;
  - Windows com 16 GB, rtf 0.9 e GPU dedicada → medium;
  - rtf null → light no Windows de 16 GB;
  - `pronunciationEnabled(1.2)` → false, `(0.9)` → true, `(null)` → true.
- [ ] **Step 3:** Implementar. Rodar `npm test`, `npm run typecheck` e `npm run lint`.
- [ ] **Step 4:** Commit `feat: AI deps, hardware detection and tier choice`.

---

### Task 2: Transcrição com transformers.js (substitui o whisper-cli)

**Files:**
- Create: `src/main/ai/stt.ts`
- Modify: `src/shared/wav.ts` (+ `decodeWav`), `src/main/ipc.ts`, `README.md`
- Delete: `src/main/speech/whisper.ts`, `tests/main/whisper.test.ts` (o conteúdo útil vai para os novos testes)
- Test: `tests/shared/wav.test.ts`, `tests/main/stt.test.ts`

**Interfaces:**
- Consumes: `TranscribeResult` (`src/shared/api.ts`), `STT_MODEL` (Task 1).
- Produces:

```ts
// wav.ts
export function decodeWav(bytes: Uint8Array): { samples: Float32Array; sampleRate: number }   // PCM16 mono; lança Error em formato não suportado
// stt.ts
export function configureModels(modelsDir: string, allowRemote: boolean): void   // env.cacheDir = modelsDir; env.allowRemoteModels = allowRemote
export function createTranscriber(): { transcribe(samples: Float32Array): Promise<TranscribeResult>; dispose(): Promise<void> }
export function cleanTranscript(text: string): string   // remove [BLANK_AUDIO], [..], (..), espaços extras (reaproveita a lógica de cleanWhisperOutput)
```

O pipeline é carregado sob demanda e reaproveitado. Se o modelo não estiver no cache, devolve `{ ok:false, reason:'no-model' }`. Qualquer outra falha devolve `reason:'failed'`. O handler IPC `transcribe` passa a fazer `decodeWav(bytes)` e chamar `transcriber.transcribe(samples)`, sem arquivo temporário. As variáveis `WHISPER_BIN` e `WHISPER_MODEL` saem do README.

- [ ] **Step 1: Testes que falham:**
  - `decodeWav(encodeWav(x, 16000))` faz o caminho de volta com tolerância de 1/32768;
  - `decodeWav` rejeita um cabeçalho que não seja RIFF;
  - `cleanTranscript` passa nos mesmos casos do antigo `cleanWhisperOutput`;
  - `test.skipIf(!modelCached)`: transcrever `tests/fixtures/age.wav` dá `checkAnswer(..., accepted ['I am twenty-five years old']) === 'correct'`;
  - sem o modelo no cache e com `allowRemote=false` → `reason: 'no-model'`.
  
  O cache de teste fica em `~/.cache/ingles-models`. O teste baixa o modelo uma vez com `allowRemote=true` quando a variável `INGLES_DOWNLOAD_MODELS=1` está definida.
- [ ] **Step 2:** Implementar, remover os arquivos antigos e rodar `INGLES_DOWNLOAD_MODELS=1 npm test` uma vez (baixa uns 77 MB). Depois rodar `npm test` normal, `typecheck` e `lint`.
- [ ] **Step 3:** Commit `feat: transformers.js speech-to-text replaces whisper-cli`.

---

### Task 3: Avaliação de pronúncia

**Files:**
- Create: `src/main/ai/phonemes.ts` (puro: decodificação CTC, tokenização IPA, alinhamento e nota), `src/main/ai/pronunciation.ts` (wrapper do modelo + phonemizer)
- Modify: `src/shared/api.ts` (tipo `PronunciationResult`; `TranscribeResult` ok ganha `pronunciation?`), `src/main/ipc.ts` (`transcribe(wav, expected?)`), `src/preload/index.ts`
- Test: `tests/main/phonemes.test.ts`, `tests/main/pronunciation.test.ts`

**Interfaces:**

```ts
// api.ts
export type WordScore = { word: string; ok: boolean; expected: string; heard: string }
export type PronunciationResult = { score: number /* 0..100 */; words: WordScore[] }
// AppApi.transcribe passa a ser: transcribe(wav: Uint8Array, expected?: string): Promise<TranscribeResult>
// phonemes.ts
export function ctcGreedyDecode(logits: Float32Array, frames: number, vocabSize: number, idToToken: string[], blankId: number): string[]
export function tokenizeIpa(ipa: string, vocab: Set<string>): string[]   // remove ˈ ˌ e marcas de duração que não estão no vocab; match guloso do maior token
export function scoreWords(expectedByWord: { word: string; phones: string[] }[], heard: string[]): PronunciationResult
// pronunciation.ts
export const WORD_OK_PER = 0.34
export function createPronunciationScorer(): { score(samples: Float32Array, expectedText: string): Promise<PronunciationResult | null>; dispose(): Promise<void> }
```

- **`scoreWords`:** alinha todos os fonemas esperados (concatenados) com os ouvidos por Levenshtein com backtrace. Cada fonema esperado aponta para a sua palavra, e o PER da palavra é igual a erros dela dividido pelo número de fonemas dela. A palavra fica `ok` quando PER ≤ `WORD_OK_PER`. `score = round(100 * (1 - PER total))`, limitado a 0..100.
- **`score()`:** devolve `null` quando o áudio tem menos de 0,5 s ou quando os fonemas ouvidos ficam vazios.
- **Texto esperado:** antes de fonemizar palavra por palavra com `phonemizer` (en-us), passa por `normalize()` de `src/shared/matcher.ts`, que expande contrações, escreve números por extenso e tira a pontuação.
- **Quando roda:** o handler `transcribe` só pontua se `expected` vier preenchido e a pronúncia estiver habilitada (Task 5 fornece o status; até lá, sempre habilitada). Falha da pronúncia nunca derruba a transcrição: vira `pronunciation` ausente.

- [ ] **Step 1: Testes que falham** (com dados sintéticos):
  - `ctcGreedyDecode` colapsa repetições e remove o blank;
  - `tokenizeIpa('ˈhɛloʊ', vocab)` → `['h','ɛ','l','oʊ']` quando `'oʊ'` está no vocab;
  - `scoreWords` com fonemas idênticos → score 100 e todas as palavras ok;
  - uma palavra com metade dos fonemas trocados → essa palavra fica `ok:false` e as outras ok;
  - fonemas ouvidos vazios → score 0;
  - `test.skipIf(!modelCached)`: `tests/fixtures/age.wav` com o texto "I am twenty five years old" dá score ≥ 70;
  - o mesmo áudio com o texto "the weather is nice today" dá score < 50;
  - áudio de 0,2 s → `null`.
- [ ] **Step 2:** Implementar e baixar uma vez com `INGLES_DOWNLOAD_MODELS=1` (~318 MB). Rodar `npm test`, `typecheck` e `lint`.
- [ ] **Step 3:** Commit `feat: phoneme-level pronunciation scoring`.

---

### Task 4: Correção de respostas livres com LLM

**Files:**
- Create: `src/main/ai/freeSpeak.ts`
- Modify: `src/shared/api.ts` (`FreeSpeakEval`, `AppApi.evaluateFreeSpeak`), `src/main/ipc.ts`, `src/preload/index.ts`
- Test: `tests/main/freeSpeak.test.ts`

**Interfaces:**

```ts
// api.ts
export type FreeSpeakInput = { prompt_en: string; guidelines_pt: string[]; transcript: string }
export type FreeSpeakEval = { ok: true; correct: boolean; feedback_pt: string; corrected_en: string } | { ok: false; reason: 'no-model' | 'failed' | 'timeout'; message: string }
// AppApi: evaluateFreeSpeak(input: FreeSpeakInput): Promise<FreeSpeakEval>
// freeSpeak.ts
export const FREE_SPEAK_TIMEOUT_MS = 60_000
export function buildPrompt(input: FreeSpeakInput): string
export function parseEval(raw: string): FreeSpeakEval   // JSON {correct:boolean, feedback_pt:string, corrected_en:string}; inválido → {ok:false, reason:'failed'}
export function createFreeSpeakEvaluator(modelPath: string): { evaluate(input: FreeSpeakInput): Promise<FreeSpeakEval>; dispose(): Promise<void> }
```

- **Prompt:** em português, papel de professor de inglês para brasileiros. Inclui a pergunta, as diretrizes da aula e o que o aluno disse. Pede para julgar se a resposta atende às diretrizes e é compreensível, com uma tolerância explícita: pequenos erros não reprovam ("na dúvida, aprove"). Pede também `feedback_pt` com no máximo 2 frases em português e `corrected_en` com a versão corrigida em inglês.
- **Saída:** forçada com `createGrammarForJsonSchema`. `maxTokens: 300`. Timeout com `AbortSignal`, devolvendo `reason: 'timeout'`.
- **Thinking:** desligado para Qwen3.5. Usar o chat wrapper padrão do node-llama-cpp; se o modelo emitir `<think>`, removê-lo antes do parse.
- **Carregamento:** o modelo é carregado sob demanda e reaproveitado. Se o arquivo não existir → `reason: 'no-model'`.

- [ ] **Step 1: Testes que falham:**
  - `buildPrompt` contém a pergunta, cada diretriz e a transcrição;
  - `parseEval` com JSON válido → ok;
  - `parseEval` com `<think>…</think>` antes do JSON → ok;
  - `parseEval` com lixo → failed;
  - `parseEval` com `feedback_pt` vazio → failed;
  - modelo inexistente → no-model;
  - `test.skipIf(!llmCached)`: com o modelo leve, pergunta "What do you do on weekends?", diretriz "Usar presente simples" e transcrição "On weekends I play soccer and I visit my family" → `correct: true` e `feedback_pt` não vazio.
- [ ] **Step 2:** Implementar. Baixar o modelo leve uma vez para o teste de integração em `~/.cache/ingles-models/` (1,3 GB), via `createModelDownloader` ou `curl`. Rodar `npm test`, `typecheck` e `lint`.
- [ ] **Step 3:** Commit `feat: local LLM evaluation of free-speaking answers`.

---

### Task 5: Preparação da IA (download, benchmark, status) e IPC

**Files:**
- Create: `src/main/ai/setup.ts`, `resources/benchmark.wav` (cópia de `tests/fixtures/age.wav`)
- Modify: `src/shared/api.ts`, `src/main/ipc.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`
- Test: `tests/main/setup.test.ts`

**Interfaces:**

```ts
// api.ts
export type AiStatus = { tier: Tier | null; hardware: Hardware | null; rtf: number | null;
  ready: { stt: boolean; pronunciation: boolean; llm: boolean }; pronunciationEnabled: boolean }
export type AiProgress = { phase: 'stt' | 'pronunciation' | 'benchmark' | 'llm' | 'done' | 'error'; percent: number; message: string }
// AppApi += aiStatus(): Promise<AiStatus>; setupAi(tier?: Tier): Promise<AiStatus>; onAiProgress(cb: (p: AiProgress) => void): () => void
// setup.ts
export type Downloader = { hf(repo: string, onPct: (p: number) => void): Promise<void>; gguf(m: ModelFile, dest: string, onPct: (p: number) => void): Promise<void> }
export function createAiSetup(o: { modelsDir: string; downloader: Downloader; detect: () => Promise<Hardware>; benchmark: () => Promise<number> }): {
  status(): Promise<AiStatus>; run(tier: Tier | undefined, onProgress: (p: AiProgress) => void): Promise<AiStatus> }
```

- **Fluxo de `run`:**
  1. detecta o hardware;
  2. baixa o STT (`hf`, com `allowRemote=true` só durante o download);
  3. faz o benchmark e calcula o `rtf`;
  4. baixa a pronúncia, se habilitada;
  5. escolhe o pacote (`tier` explícito ou `chooseTier`);
  6. baixa o GGUF para `.part`, confere o tamanho (`bytes` ±1%) e renomeia;
  7. grava `modelsDir/ai-state.json` (`{tier, hardware, rtf, pronunciationEnabled}`) só no final;
  8. volta a usar `allowRemote=false`.
- **Prontidão:** é calculada olhando o disco (arquivos existem) mais o `ai-state.json`.
- **Troca de pacote:** baixa o novo GGUF e só depois apaga o anterior.
- **Erro:** emite `phase:'error'` com a mensagem em português e mantém o estado anterior.
- **Downloader real:** `hf` carrega o pipeline/modelo do transformers.js com `progress_callback`; `gguf` usa `createModelDownloader` do node-llama-cpp ou `fetch` em stream com o tamanho do arquivo.
- **Progresso no IPC:** vai por `webContents.send('ai-progress', p)`. O preload expõe `onAiProgress` com `ipcRenderer.on`/`off`.

- [ ] **Step 1: Testes que falham** (downloader, detect e benchmark falsos, diretório temporário):
  - o run completo grava o estado e `status().ready` fica todo true;
  - download que falha no meio → nenhum `ai-state.json`, nenhum arquivo final, só no máximo um `.part`, e o próximo run conclui;
  - tamanho do GGUF errado → erro e arquivo não promovido;
  - `rtf` 1.2 → pronúncia não é baixada e `pronunciationEnabled` false;
  - troca de light para medium → o arquivo light continua até o medium ficar pronto e depois é removido;
  - a sequência de fases emitidas é stt → benchmark → pronunciation → llm → done.
- [ ] **Step 2:** Implementar e ligar no IPC. O `transcribe` usa `pronunciationEnabled` do status e o `evaluateFreeSpeak` usa o GGUF do pacote atual. Rodar `npm test`, `typecheck` e `lint`.
- [ ] **Step 3:** Commit `feat: first-run AI setup with tier choice, benchmark and resumable downloads`.

---

### Task 6: Telas — preparação, configurações e feedback da IA

**Files:**
- Create: `src/renderer/src/screens/SetupScreen.tsx`, `src/renderer/src/components/PronunciationView.tsx`
- Modify: `src/renderer/src/App.tsx`, `src/renderer/src/screens/HomeScreen.tsx`, `src/renderer/src/components/SpokenExercise.tsx`, `src/renderer/src/components/RecordButton.tsx` (aceita `expected?: string` e repassa `pronunciation`), CSS

**Comportamento:**
- **Primeira abertura:** se `aiStatus().tier` for null, o App mostra a `SetupScreen` antes dos perfis. A tela mostra o hardware detectado em português (processador, RAM, se tem placa de vídeo) e o pacote recomendado com o tamanho total do download. Tem os botões "Baixar e preparar", "Escolher outro pacote" (leve, médio ou forte, com aviso ao escolher um acima do recomendado) e "Agora não", que deixa usar o app com marcação manual. Durante o download mostra a barra de progresso por fase; em caso de erro, mostra "Tentar de novo".
- **Início:** o link "Configurações da IA" volta à `SetupScreen` em modo troca de pacote.
- **Pronúncia:** nos exercícios `repeat` e `vocab` do solo, a gravação manda `expected` (o `prompt` do repeat ou o `example_en` do vocab). O `ResultView` mostra o `PronunciationView` abaixo do veredito: nota de 0 a 100 e as palavras com `ok:false` destacadas, com rótulo de texto e sem depender só de cor. Fica claro que é orientação e que não muda o veredito.
- **Resposta livre no solo:** depois da transcrição chama `evaluateFreeSpeak` e mostra "Analisando sua resposta…" com `aria-live`. Com `ok:true`, mostra o veredito, o `feedback_pt` e o `corrected_en`, com "Continuar" e "Acho que acertei", como no `ResultView`. Com `ok:false`, mostra a mensagem e cai no checklist de autoavaliação que já existe. Remover o comentário `shortcut:` do Plano 1.
- **Modo guiado:** sem mudança.

- [ ] **Step 1:** Implementar. A lógica pura que surgir (por exemplo, formatar o hardware em português) leva teste em `tests/renderer/`.
- [ ] **Step 2:** Rodar `npm test`, `typecheck`, `lint` e `build`. Rodar `npm run dev` por cerca de 20 s sem erros. As verificações manuais ficam pendentes para uma pessoa:
  - a primeira abertura mostra a preparação e o download conclui;
  - um "repeat" mostra a nota de pronúncia;
  - uma resposta livre recebe o feedback em português;
  - sem internet, "Agora não" leva ao app com marcação manual.
- [ ] **Step 3:** Commit `feat: AI setup screen, pronunciation feedback and free-speak evaluation UI`.
