# Plano 1 — Núcleo do app (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um app Electron que roda no Mac de desenvolvimento e já tem:
- perfis e uma trilha de unidades;
- sessões com tempo escolhido;
- exercícios de tipos variados e intercalados;
- modo solo, que corrige a fala transcrevendo com o Whisper e comparando com as respostas aceitas e os erros comuns;
- modo guiado sem IA, em que quem ensina marca os exercícios falados;
- 2 unidades de exemplo do A1.

**Architecture:** Electron com três camadas (main, preload, renderer React). Toda a lógica de curso (formato do conteúdo, correção, montagem da sessão, progresso) é TypeScript puro em `src/shared/`, testado com Vitest. O main cuida do disco (conteúdo, estado salvo) e roda o `whisper-cli` como processo filho. O renderer grava o microfone, chama o main por IPC e aplica as funções puras ao progresso.

**Tech Stack:** Electron + electron-vite (template react-ts), React 18, TypeScript, zod, Vitest. Nenhuma outra dependência de runtime.

**Spec:** `docs/superpowers/specs/2026-10-15-app-ingles-design.md`

## Roteiro dos planos

Este é o primeiro de cinco. Cada um entrega software que funciona sozinho.

1. **Núcleo do app** (este plano).
2. **IA local completa**: detecção de hardware e teste de velocidade, escolha do pacote leve/médio/forte, download dos modelos no primeiro uso com barra de progresso, modelo de texto (llama.cpp) para respostas livres guiado pelas diretrizes da aula, avaliação de pronúncia e desligamento só da peça que a máquina não aguenta. Substitui os atalhos de Whisper deste plano.
3. **Empacotamento e distribuição**: DMG para Mac, instalador NSIS para Windows via GitHub Actions, conteúdo empacotado como recurso, permissão de microfone no macOS e roteiro de teste para o notebook Windows deles. Vem antes do conteúdo de propósito: o desempenho no notebook i5 é o maior risco da spec e precisa ser testado cedo.
4. **Nivelamento e provas de nível**: teste adaptativo com itens de fala e de escuta, que substitui a escolha manual de nível deste plano. Inclui também a prova final de cada nível: bloqueio da trilha na passagem de nível, aprovação com 70% no total e pelo menos 50% em cada parte, e revisão priorizada das unidades fracas em caso de reprovação. Este plano traz a prova do A1 como exemplo.
5. **Conteúdo do curso A1–C1 + áudios**: cerca de 60 unidades, as provas de A2 a C1, geração dos áudios com voz sintética local durante a construção e o protocolo para tocar os áudios embutidos. Substitui o atalho de `speechSynthesis` deste plano.

## Global Constraints

- Feedback, instruções e textos de interface em **português**. O conteúdo de inglês fica em inglês.
- Durações de sessão exatamente: **10, 20, 30, 40, 50, 60** minutos.
- Níveis exatamente: **A1, A2, B1, B2, C1** (sem C2).
- Blocos da unidade, nesta ordem: **aquecimento, vocabulário, pronúncia, listening, conversação, revisão** (`warmup, vocabulary, pronunciation, listening, conversation, review`).
- Toda sessão começa revisando os erros pendentes (se houver) e termina com uma conversa curta (se a unidade tiver uma).
- Uma única posição na trilha por perfil. Os dois modos avançam essa mesma posição.
- No modo guiado, as respostas esperadas e as notas de quem ensina ficam **escondidas por padrão**.
- Quem ensina dá a palavra final sobre a correção: o veredito manual sempre vence o automático.
- **O modo guiado não usa IA nem microfone.** Nos exercícios falados, quem ensina marca certo ou errado. Os exercícios de clicar ou digitar são conferidos pelo app, sem IA.
- Mistura de exercícios: cada bloco tem **pelo menos 2 tipos diferentes**, e em cada unidade **pelo menos metade** dos exercícios é falada (`repeat`, `translate`, `listen_answer`, `free_speak`, `vocab`).
- Na dúvida, aceitar é melhor que reprovar.
- Nenhum acesso à rede em tempo de execução. Nenhum serviço pago.
- O progresso é salvo a cada resposta, sem esperar o fim da sessão.
- Nome do produto: **"Inglês"**, pacote `ingles` (decisão minha; dá para trocar depois sem impacto).

## Review Focus

1. **Microfone negado ou ausente**: o app mostra em português "Não consegui acessar o microfone" com o caminho das configurações, a sessão continua (dá para marcar na mão) e nada trava. Teste no Task 6 (transcritor sem binário ou modelo) e verificação manual no Task 7.
2. **Silêncio, ruído ou `[BLANK_AUDIO]` do Whisper**: o veredito é `unclear`, o app pede para repetir e **não registra erro**. Testes no Task 3 e no Task 6.
3. **Mesma resposta escrita de jeitos diferentes pelo Whisper** ("I'm 25" contra "I am twenty-five"): é aceita. Testes de normalização no Task 3.
4. **App fechado no meio de um salvamento ou `state.json` corrompido**: nenhum progresso é perdido sem aviso. A gravação é atômica e o arquivo corrompido vira backup em vez de ser sobrescrito. Testes no Task 5.
5. **Fim do curso, ou sessão maior que o conteúdo restante**: a sessão monta o que sobra e sinaliza "curso concluído", sem estourar. Testes no Task 4.

---

## Estrutura de arquivos

```
content/units/a1-01-greetings.json        unidade de exemplo
content/units/a1-02-numbers-age.json      unidade de exemplo
src/shared/content.ts                     schemas zod, tipos do curso, navegação na trilha
src/shared/matcher.ts                     normalização e correção da resposta falada
src/shared/progress.ts                    progresso: tentativas, blocos, sessões, resumo do solo
src/shared/session.ts                     montagem da sessão a partir da duração
src/shared/wav.ts                         codificação WAV PCM16
src/shared/api.ts                         contrato IPC (interface AppApi)
src/main/index.ts                         (template) janela + registro de IPC e permissões
src/main/content/load-course.ts           leitura e validação de content/units/*.json
src/main/store.ts                         estado salvo (perfis + progresso), gravação atômica
src/main/speech/whisper.ts                transcrição via whisper-cli
src/main/ipc.ts                           handlers IPC
src/preload/index.ts                      expõe window.api
src/renderer/src/App.tsx                  máquina de telas
src/renderer/src/screens/*.tsx            Profiles, Home, Session, Summary
src/renderer/src/components/*.tsx         ExerciseView, RecordButton, ResultView, TeacherPanel, SoloRecap, PhaseTimer
src/renderer/src/audio/recorder.ts        captura do microfone a 16 kHz
src/renderer/src/audio/speak.ts           tocar o inglês (speechSynthesis neste plano)
tests/...                                 espelha src/; fixtures em tests/fixtures/
```

---

### Task 1: Esqueleto do projeto

**Files:**
- Create: projeto electron-vite na raiz `/Users/yagoramires/push-to-talk` (mantendo `docs/`), `vitest.config.ts`, `.gitignore`, `tests/sanity.test.ts`
- Modify: `package.json` (nome `ingles`, productName `Inglês`, script `test`), `tsconfig.node.json` e `tsconfig.web.json` (incluir `src/shared/**/*`)

**Interfaces:**
- Produces: scripts `npm run dev`, `npm test`, `npm run typecheck`, `npm run lint`. Pasta `src/shared/` visível para main e renderer, com imports relativos.

- [ ] **Step 1: Gerar o template num diretório temporário e copiar para a raiz**

```bash
cd /tmp && npm create @quick-start/electron@latest ingles-scaffold -- --template react-ts --skip
rsync -a --exclude .git /tmp/ingles-scaffold/ /Users/yagoramires/push-to-talk/
cd /Users/yagoramires/push-to-talk && npm install && npm install zod && npm install -D vitest
```

- [ ] **Step 2: Configurar** `package.json` (`"name": "ingles"`, `"productName": "Inglês"`, `"test": "vitest run"`). Criar `vitest.config.ts` com `test.include: ['tests/**/*.test.ts']` e `environment: 'node'`. Acrescentar `src/shared/**/*` ao `include` dos dois tsconfigs. O `.gitignore` deve cobrir `node_modules`, `out`, `dist` e `*.log`.

- [ ] **Step 3: Escrever `tests/sanity.test.ts`** com `expect(1 + 1).toBe(2)` e rodar `npm test`. Esperado: 1 passed.

- [ ] **Step 4: Verificar** que `npm run typecheck` passa e que `npm run dev` abre a janela do template. Fechar a janela.

- [ ] **Step 5: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold electron-vite react-ts app with vitest"
```

---

### Task 2: Formato do conteúdo, leitura do curso e 2 unidades de exemplo

**Files:**
- Create: `src/shared/content.ts`, `src/main/content/load-course.ts`, `content/units/a1-01-greetings.json`, `content/units/a1-02-numbers-age.json`
- Test: `tests/shared/content.test.ts`, `tests/main/load-course.test.ts`, `tests/content.test.ts`, `tests/fixtures/course.ts`

**Interfaces:**
- Produces (em `src/shared/content.ts`, schemas zod com tipos inferidos de mesmo nome):

```ts
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type Level = (typeof LEVELS)[number]
export const BLOCK_KINDS = ['warmup', 'vocabulary', 'pronunciation', 'listening', 'conversation', 'review'] as const
export type BlockKind = (typeof BLOCK_KINDS)[number]

export type CommonError = { id: string; match: string /* regex sobre o texto normalizado */; explanation_pt: string; correction_en: string }
export type SpokenExercise = {
  id: string; kind: 'repeat' | 'translate' | 'listen_answer'
  instruction_pt: string; prompt?: string /* texto mostrado */; listen?: string /* inglês a ser tocado */
  audio?: string /* arquivo embutido — Plano 5 */; accepted: string[] /* min 1 */; commonErrors: CommonError[]
}
export type VocabCard = { id: string; kind: 'vocab'; word_en: string; meaning_pt: string; example_en: string; audio?: string }
export type FreeSpeak = { id: string; kind: 'free_speak'; instruction_pt: string; prompt_en: string; guidelines_pt: string[] /* min 1 */ }
export type ChoiceExercise = { id: string; kind: 'choice'; instruction_pt: string; prompt?: string; listen?: string; audio?: string;
  options: string[] /* 2..5 */; answer: number /* índice em options */; explanation_pt?: string }
export type FillExercise = { id: string; kind: 'fill'; instruction_pt: string; sentence: string /* contém "___" exatamente uma vez */;
  accepted: string[] /* min 1 */; commonErrors: CommonError[] }
export type OrderExercise = { id: string; kind: 'order'; instruction_pt: string; accepted: string[] /* min 1; as palavras de accepted[0] são embaralhadas na tela */ }
export type MatchExercise = { id: string; kind: 'match'; instruction_pt: string; pairs: { en: string; pt: string }[] /* 3..6 */ }
export type Exercise = SpokenExercise | VocabCard | FreeSpeak | ChoiceExercise | FillExercise | OrderExercise | MatchExercise
export const SPOKEN_KINDS = ['repeat', 'translate', 'listen_answer', 'free_speak', 'vocab'] as const
export type TeacherNotes = { goal_pt: string; prompts: string[]; watchFor: string[] }
export type Block = { id: string; kind: BlockKind; minutes: number /* int 1..15 */; teacher: TeacherNotes; exercises: Exercise[] /* min 1 */ }
export type Unit = { id: string; level: Level; order: number; title_pt: string; title_en: string; objective_pt: string; blocks: Block[] }
export type Course = { units: Unit[] }   // ordenado por nível e depois por order
export type Position = { unitId: string; blockIndex: number }

export const UnitSchema: z.ZodType<Unit>
export function nextPosition(course: Course, pos: Position): Position | null   // null = fim do curso
export function findExercise(course: Course, exerciseId: string): { unit: Unit; block: Block; exercise: Exercise } | undefined
export function availableLevels(course: Course): Level[]
```

- Produces (em `src/main/content/load-course.ts`): `loadCourse(dir: string): Promise<Course>`. Lê `dir/units/*.json` e valida cada arquivo com `UnitSchema`. Os ids de unidade, bloco e exercício precisam ser únicos no curso inteiro. Ordena por `LEVELS.indexOf(level)` e depois por `order`. Em caso de falha, lança `ContentError` com uma mensagem que traz o nome do arquivo e o caminho do problema apontado pelo zod.
- Produces (em `tests/fixtures/course.ts`): `makeCourse()` monta 2 unidades A1 (`u1`, `u2`), cada uma com os 6 blocos na ordem padrão, de 4 minutos cada. Cada bloco tem 1 `SpokenExercise` com id `${unit}-${kind}-ex`. O bloco `conversation` também tem um `FreeSpeak` com id `${unit}-conv-free`. Os testes dos Tasks 4 e 7 usam essa fixture.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// tests/shared/content.test.ts
test('nextPosition walks blocks, then units, then ends', () => {
  const c = makeCourse()
  expect(nextPosition(c, { unitId: 'u1', blockIndex: 0 })).toEqual({ unitId: 'u1', blockIndex: 1 })
  expect(nextPosition(c, { unitId: 'u1', blockIndex: 5 })).toEqual({ unitId: 'u2', blockIndex: 0 })
  expect(nextPosition(c, { unitId: 'u2', blockIndex: 5 })).toBeNull()
})
test('findExercise locates unit and block', () => {
  expect(findExercise(makeCourse(), 'u2-listening-ex')?.block.kind).toBe('listening')
})
test('UnitSchema rejects spoken exercise without accepted answers', () => {
  const u = structuredClone(makeCourse().units[0]); (u.blocks[0].exercises[0] as any).accepted = []
  expect(UnitSchema.safeParse(u).success).toBe(false)
})

// tests/main/load-course.test.ts  (escreve JSON num diretório temporário)
test('loads, validates and sorts units by level then order')        // grava a1 order 2, a1 order 1 → ids em ordem 1,2
test('throws ContentError naming the file on invalid unit')           // expect(...).rejects.toThrow(/bad\.json/)
test('throws ContentError on duplicate exercise id across units')     // rejects.toThrow(/duplicate/i)

// tests/content.test.ts — o conteúdo real do repositório
test('all units in content/ are valid', async () => {
  const course = await loadCourse(join(__dirname, '..', 'content'))
  expect(course.units.map(u => u.id)).toEqual(['a1-01-greetings', 'a1-02-numbers-age'])
  for (const u of course.units) {
    expect(u.blocks.map(b => b.kind)).toEqual([...BLOCK_KINDS])
    const total = u.blocks.reduce((s, b) => s + b.minutes, 0)
    expect(total).toBeGreaterThanOrEqual(24); expect(total).toBeLessThanOrEqual(28)
    for (const b of u.blocks) expect(new Set(b.exercises.map(e => e.kind)).size).toBeGreaterThanOrEqual(2)
    const all = u.blocks.flatMap(b => b.exercises)
    expect(all.filter(e => (SPOKEN_KINDS as readonly string[]).includes(e.kind)).length * 2).toBeGreaterThanOrEqual(all.length)
  }
  const kindsUsed = new Set(course.units.flatMap(u => u.blocks.flatMap(b => b.exercises.map(e => e.kind))))
  expect([...kindsUsed].sort()).toEqual(['choice', 'fill', 'free_speak', 'listen_answer', 'match', 'order', 'repeat', 'translate', 'vocab'])
})
test('UnitSchema rejects choice answer out of range and fill without exactly one ___')
```

- [ ] **Step 2: Rodar** `npm test` e confirmar que falha (módulos inexistentes).

- [ ] **Step 3: Implementar `src/shared/content.ts` e `src/main/content/load-course.ts`** com as assinaturas acima. O `UnitSchema` usa `z.discriminatedUnion('kind', …)` nos exercícios.

- [ ] **Step 4: Escrever as duas unidades de exemplo.** Requisitos de conteúdo:
  - os 6 blocos na ordem padrão, somando de 24 a 28 minutos;
  - `teacher` enxuto em todos os blocos: objetivo, 2 a 4 perguntas para puxar conversa e 2 a 3 erros comuns a observar;
  - cada `SpokenExercise` com todas as formas naturais em `accepted`, e `commonErrors` com `match` escrito em forma normalizada (minúsculas, contrações expandidas, números por extenso, sem pontuação);
  - o bloco `conversation` com um `FreeSpeak`;
  - exercícios intercalados: pelo menos 2 tipos por bloco, pelo menos metade falados, e as duas unidades juntas usando os 9 tipos (a múltipla escolha de listening usa `listen`);
  - `a1-02-numbers-age` precisa ter o exercício "Diga em inglês: Eu tenho 25 anos", com o erro `"\\bi have \\w+( \\w+)? years\\b"` explicado em português.

  Exemplo do formato:

```json
{ "id": "a1-02-age-translate", "kind": "translate",
  "instruction_pt": "Diga em inglês: \"Eu tenho 25 anos.\"",
  "accepted": ["I am twenty-five years old", "I'm 25", "I'm 25 years old", "I am 25"],
  "commonErrors": [{ "id": "have-years", "match": "\\bi have \\w+( \\w+)? years\\b",
    "explanation_pt": "Para idade, o inglês usa o verbo \"to be\": \"I am 25\", e não \"I have 25 years\".",
    "correction_en": "I'm 25 years old." }] }
```

- [ ] **Step 5: Rodar** `npm test`. Esperado: todos passam.

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: content schema, course loader and two A1 sample units"`

---

### Task 3: Correção das respostas (fala e exercícios de clicar ou digitar)

**Files:**
- Create: `src/shared/matcher.ts`
- Test: `tests/shared/matcher.test.ts`

**Interfaces:**
- Consumes: `CommonError`, `ChoiceExercise`, `FillExercise`, `OrderExercise` e `MatchExercise` de `src/shared/content.ts`.
- Produces:

```ts
export const ALMOST_THRESHOLD = 0.75
export type Verdict = 'correct' | 'almost' | 'error' | 'unclear'
export type FinalVerdict = 'correct' | 'error'
export type WordDiff = { word: string; status: 'ok' | 'missing' | 'extra' }
export type CheckResult = { verdict: Verdict; matchedError?: CommonError; closest?: string; diff?: WordDiff[] }
export function normalize(text: string): string
export function checkAnswer(transcript: string, ex: { accepted: string[]; commonErrors: CommonError[] }): CheckResult
export function wordDiff(expected: string, actual: string): WordDiff[]          // recebe textos já normalizados
export function toFinalVerdict(r: CheckResult): FinalVerdict | null             // almost→correct, unclear→null
// exercícios de clicar/digitar — sem IA; 'almost' só existe em checkFill (via checkAnswer)
export function checkChoice(ex: ChoiceExercise, index: number): CheckResult    // closest = options[answer]
export function checkFill(ex: FillExercise, typed: string): CheckResult        // = checkAnswer(typed, ex)
export function checkOrder(ex: OrderExercise, words: string[]): CheckResult    // só igualdade exata normalizada; ordem errada nunca é 'almost'
export function checkMatch(ex: MatchExercise, chosen: Record<string, string>): CheckResult  // en→pt; correct só se todos os pares baterem
```

- [ ] **Step 1: Escrever os testes que falham**

```ts
const ex = { accepted: ['I am twenty-five years old', "I'm 25"], commonErrors: [{ id: 'have-years',
  match: '\\bi have \\w+( \\w+)? years\\b', explanation_pt: 'Idade usa "to be".', correction_en: "I'm 25 years old." }] }

test('normalize: case, curly apostrophes, contractions, numbers 0-999, punctuation, spaces', () => {
  expect(normalize("I'm 25!")).toBe('i am twenty five')
  expect(normalize('I AM twenty-five,  years old.')).toBe('i am twenty five years old')
  expect(normalize('It’s 100')).toBe('it is one hundred')
  expect(normalize("You can't, I won't")).toBe('you cannot i will not')
  expect(normalize('342')).toBe('three hundred forty two')
  expect(normalize('   ')).toBe('')
})
test('exact match after normalization is correct', () => {
  expect(checkAnswer("I'm twenty five", ex).verdict).toBe('correct')
  expect(checkAnswer('I am 25 years old.', ex).verdict).toBe('correct')
})
test('common error beats fuzzy match and carries the explanation', () => {
  const r = checkAnswer('I have 25 years', ex)
  expect(r.verdict).toBe('error'); expect(r.matchedError?.id).toBe('have-years')
})
test('close answer is almost and points to closest accepted', () => {
  const r = checkAnswer('yes I am twenty five years old', ex)
  expect(r.verdict).toBe('almost'); expect(r.closest).toBe('I am twenty-five years old')
})
test('unrelated answer is error without explanation but with closest', () => {
  const r = checkAnswer('my name is john', ex)
  expect(r.verdict).toBe('error'); expect(r.matchedError).toBeUndefined(); expect(r.closest).toBeDefined()
})
test('empty transcript is unclear and is not recorded', () => {
  const r = checkAnswer('', ex); expect(r.verdict).toBe('unclear'); expect(toFinalVerdict(r)).toBeNull()
})
test('almost counts as correct', () => { expect(toFinalVerdict({ verdict: 'almost' })).toBe('correct') })
test('wordDiff marks missing and extra words', () => {
  expect(wordDiff('i am twenty five years old', 'i am twenty five')).toEqual([
    { word: 'i', status: 'ok' }, { word: 'am', status: 'ok' }, { word: 'twenty', status: 'ok' },
    { word: 'five', status: 'ok' }, { word: 'years', status: 'missing' }, { word: 'old', status: 'missing' }])
  expect(wordDiff('i am', 'yes i am').map(d => d.status)).toEqual(['extra', 'ok', 'ok'])
})
test('checkChoice', () => {
  const c = { id: 'c', kind: 'choice', instruction_pt: '', options: ['am', 'is', 'are'], answer: 0 } as const
  expect(checkChoice(c, 0).verdict).toBe('correct')
  expect(checkChoice(c, 2)).toMatchObject({ verdict: 'error', closest: 'am' })
})
test('checkOrder: exact order only, swapped words are an error', () => {
  const o = { id: 'o', kind: 'order', instruction_pt: '', accepted: ['Where do you live?'] } as const
  expect(checkOrder(o, ['where', 'do', 'you', 'live']).verdict).toBe('correct')
  expect(checkOrder(o, ['where', 'you', 'do', 'live']).verdict).toBe('error')
})
test('checkMatch requires every pair', () => {
  const m = { id: 'm', kind: 'match', instruction_pt: '', pairs: [{ en: 'dog', pt: 'cachorro' }, { en: 'cat', pt: 'gato' }, { en: 'cow', pt: 'vaca' }] } as const
  expect(checkMatch(m, { dog: 'cachorro', cat: 'gato', cow: 'vaca' }).verdict).toBe('correct')
  expect(checkMatch(m, { dog: 'gato', cat: 'cachorro', cow: 'vaca' }).verdict).toBe('error')
})
test('checkFill uses spoken normalization (contractions, case)', () => {
  const f = { id: 'f', kind: 'fill', instruction_pt: '', sentence: 'She ___ a doctor.', accepted: ['is'], commonErrors: [] } as const
  expect(checkFill(f, ' IS ').verdict).toBe('correct')
})
```

- [ ] **Step 2: Rodar** `npm test -- matcher` e confirmar que falha.

- [ ] **Step 3: Implementar.** A ordem dentro de `checkAnswer` é: transcrição vazia → `unclear`; igual a alguma resposta aceita normalizada → `correct`; algum `commonErrors` cujo `new RegExp(match)` casa → `error` com a explicação; maior semelhança por palavras (`1 - distânciaDeLevenshteinEmPalavras / max(nPalavras)`) contra as aceitas, com `>= ALMOST_THRESHOLD` → `almost`, e senão → `error`. `closest` é a resposta aceita mais parecida no texto original e `diff` é `wordDiff(normalize(closest), t)`. Na normalização, primeiro troca hífen por espaço, depois expande uma tabela fixa de contrações comuns (i'm, you're, it's, he's, she's, we're, they're, that's, what's, there's, let's, i've, i'll, i'd, don't, doesn't, didn't, can't→cannot, won't→will not, isn't, aren't, wasn't, weren't, couldn't, wouldn't, shouldn't), troca "can not" por "cannot", converte números de 0 a 999 para extenso e remove o resto da pontuação e dos apóstrofos. O `wordDiff` usa LCS.

- [ ] **Step 4: Rodar** `npm test -- matcher`. Esperado: tudo passa.

- [ ] **Step 5: Commit** `git commit -am "feat: spoken answer matcher with normalization and common errors"` (fazer `git add` dos arquivos novos antes).

---

### Task 4: Progresso e montagem da sessão

**Files:**
- Create: `src/shared/progress.ts`, `src/shared/session.ts`
- Test: `tests/shared/progress.test.ts`, `tests/shared/session.test.ts`

**Interfaces:**
- Consumes: `Course`, `Position`, `Level`, `nextPosition`, `findExercise`, `Block`, `FreeSpeak` (Task 2); `FinalVerdict` (Task 3); `makeCourse()` (fixture).
- Produces:

```ts
// progress.ts
export type Mode = 'solo' | 'guided'
export type ErrorEntry = { exerciseId: string; unitId: string; transcript: string; at: string; resolved: boolean }
export type SessionRecord = { at: string; mode: Mode; minutes: number; blocksDone: string[]; errors: number }
export type ProfileProgress = { profileId: string; startLevel: Level; position: Position | null;
  completedBlocks: string[]; errorLog: ErrorEntry[]; sessions: SessionRecord[] }
export function newProgress(profileId: string, startLevel: Level, course: Course): ProfileProgress   // lança erro se o nível não existir no curso
export function recordAttempt(p: ProfileProgress, a: { exerciseId: string; unitId: string; transcript: string; verdict: FinalVerdict; at: string }): ProfileProgress
export function completeBlock(p: ProfileProgress, course: Course, blockId: string): ProfileProgress
export function recordSession(p: ProfileProgress, r: SessionRecord): ProfileProgress
export function soloSinceLastGuided(p: ProfileProgress): { sessions: SessionRecord[]; blocksDone: string[]; openErrors: ErrorEntry[] }

// session.ts
export const DURATIONS = [10, 20, 30, 40, 50, 60] as const
export type Duration = (typeof DURATIONS)[number]
export type SessionStep =
  | { kind: 'review'; minutes: number; exerciseIds: string[] }
  | { kind: 'block'; minutes: number; unitId: string; block: Block }
  | { kind: 'wrapup'; minutes: number; unitId: string; exercise: FreeSpeak }
export type SessionPlan = { steps: SessionStep[]; courseComplete: boolean }
export function buildSession(course: Course, p: ProfileProgress, minutes: Duration): SessionPlan
```

Todas as funções são puras e devolvem objetos novos. `recordAttempt`: quando o veredito é `error`, insere ou atualiza (sem duplicar) a entrada pendente daquele exercício; quando é `correct`, marca como resolvida a entrada pendente daquele exercício. `completeBlock`: acrescenta o `blockId` uma vez só e, se ele for o bloco da posição atual, avança com `nextPosition`. `soloSinceLastGuided`: pega as sessões solo depois da última guiada (ou todas, se nunca houve guiada), a união dos blocos feitos nelas e os erros pendentes.

O algoritmo do `buildSession` não fica determinado só pela assinatura:

```
abertos  = errorLog não resolvidos, do mais antigo ao mais novo, no máximo 5
revisão  = abertos.length ? min(5, max(2, round(minutes * 0.15))) : 0
conversa = minutes <= 10 ? 2 : 4
orçamento = minutes - revisão - conversa
percorre os blocos a partir de p.position (atravessando unidades com nextPosition):
  inclui o bloco se (soma + block.minutes <= orçamento + 1) OU se ainda nenhum bloco foi incluído
  para no primeiro bloco que não couber, ou quando a posição virar null (courseComplete = true)
wrapup = FreeSpeak do bloco 'conversation' da última unidade que entrou na sessão; se não houver, não há passo de wrapup
p.position == null → steps = [revisão, se houver]; courseComplete = true
```

- [ ] **Step 1: Escrever os testes que falham**

```ts
// session.test.ts
const course = makeCourse(); const at = '2026-10-15T10:00:00Z'
const fresh = () => newProgress('p1', 'A1', course)
const withError = () => recordAttempt(fresh(), { exerciseId: 'u1-warmup-ex', unitId: 'u1', transcript: 'x', verdict: 'error', at })
const kinds = (s: SessionPlan) => s.steps.map(x => x.kind)

test('10 min with an open error: review, one block, wrapup', () => {
  const s = buildSession(course, withError(), 10)
  expect(kinds(s)).toEqual(['review', 'block', 'wrapup']); expect(s.steps[0].minutes).toBe(2)
})
test('30 min fresh covers exactly one unit', () => {
  const s = buildSession(course, fresh(), 30)
  const blocks = s.steps.filter(x => x.kind === 'block')
  expect(blocks).toHaveLength(6); expect(blocks.every(b => b.unitId === 'u1')).toBe(true)
  expect(s.steps.at(-1)).toMatchObject({ kind: 'wrapup', unitId: 'u1' })
})
test('60 min runs out of course and flags completion', () => {
  const s = buildSession(course, fresh(), 60)
  expect(s.steps.filter(x => x.kind === 'block')).toHaveLength(12); expect(s.courseComplete).toBe(true)
})
test('starts mid-unit and crosses into the next unit', () => {
  const p = { ...fresh(), position: { unitId: 'u1', blockIndex: 4 } }
  const units = buildSession(course, p, 30).steps.flatMap(x => x.kind === 'block' ? [x.unitId] : [])
  expect(units.slice(0, 2)).toEqual(['u1', 'u1']); expect(units[2]).toBe('u2')
})
test('review lists at most 5 open errors, oldest first')
test('finished course: only review, courseComplete', () => {
  const s = buildSession(course, { ...withError(), position: null }, 20)
  expect(kinds(s)).toEqual(['review']); expect(s.courseComplete).toBe(true)
})
test('no open errors: no review step', () => { expect(kinds(buildSession(course, fresh(), 20))[0]).toBe('block') })

// progress.test.ts
test('newProgress starts at first unit of the level; unknown level throws')
test('repeated error on same exercise does not duplicate; correct resolves it')
test('completeBlock advances within unit, across units, and to null at the end; no duplicate blockIds')
test('soloSinceLastGuided returns only solo sessions after the last guided one, their blocks, and open errors')
```

- [ ] **Step 2: Rodar** `npm test -- session progress` e confirmar que falha.

- [ ] **Step 3: Implementar** `progress.ts` e `session.ts`.

- [ ] **Step 4: Rodar** `npm test`. Esperado: tudo passa.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: profile progress and duration-based session builder"`

---

### Task 5: Estado salvo (perfis e progresso) e IPC

**Files:**
- Create: `src/main/store.ts`, `src/shared/api.ts`, `src/main/ipc.ts`
- Modify: `src/main/index.ts` (chamar `registerIpc` antes de criar a janela), `src/preload/index.ts` (expor `api`), `src/renderer/src/env.d.ts` (`window.api: AppApi`)
- Test: `tests/main/store.test.ts`

**Interfaces:**
- Consumes: `ProfileProgress` (Task 4), `Course` e `loadCourse` (Task 2).
- Produces:

```ts
// store.ts
export type Profile = { id: string; name: string; createdAt: string }
export type AppState = { version: 1; profiles: Profile[]; progress: Record<string, ProfileProgress> }
export type LoadResult = { state: AppState; recoveredFrom?: string /* caminho do backup do arquivo corrompido */ }
export function createStore(dir: string): { load(): Promise<LoadResult>; save(state: AppState): Promise<void> }

// api.ts — o mesmo contrato no preload e no renderer
export interface AppApi {
  loadCourse(): Promise<Course>
  loadState(): Promise<LoadResult>
  createProfile(name: string): Promise<Profile>
  saveProgress(progress: ProfileProgress): Promise<void>
  ensureMic(): Promise<boolean>
  transcribe(wav: Uint8Array): Promise<TranscribeResult>
}
export type TranscribeResult = { ok: true; text: string } | { ok: false; reason: 'no-binary' | 'no-model' | 'failed'; message: string }
```

O `load` funciona assim: arquivo ausente → estado vazio. JSON inválido ou `version !== 1` → renomeia o arquivo para `state.corrupt-<timestamp>.json`, devolve estado vazio e preenche `recoveredFrom`. O `save` grava `state.json.tmp` e depois renomeia para `state.json`, e as gravações entram numa fila para nunca rodarem ao mesmo tempo. Nos handlers IPC, o estado fica em memória no main: `createProfile` e `saveProgress` alteram o estado e chamam `save`. O diretório é `app.getPath('userData')`. O conteúdo vem de `app.isPackaged ? join(process.resourcesPath, 'content') : join(app.getAppPath(), 'content')`. Cada handler IPC é registrado com `ipcMain.handle('<nome do método>')`.

- [ ] **Step 1: Escrever os testes que falham** (com diretório temporário via `fs.mkdtemp`)

```ts
test('missing file loads empty state', async () => {
  expect((await createStore(dir).load()).state).toEqual({ version: 1, profiles: [], progress: {} })
})
test('save then load round-trips')
test('corrupt file is backed up, not overwritten, and reported', async () => {
  await writeFile(join(dir, 'state.json'), '{ not json')
  const r = await createStore(dir).load()
  expect(r.state.profiles).toEqual([]); expect(r.recoveredFrom).toMatch(/state\.corrupt-.*\.json$/)
  expect(await readFile(r.recoveredFrom!, 'utf8')).toBe('{ not json')
})
test('concurrent saves leave the last state and no tmp file', async () => {
  const s = createStore(dir)
  await Promise.all([1, 2, 3].map(n => s.save({ version: 1, profiles: [{ id: String(n), name: 'n', createdAt: 'x' }], progress: {} })))
  expect((await s.load()).state.profiles[0].id).toBe('3'); expect(existsSync(join(dir, 'state.json.tmp'))).toBe(false)
})
```

- [ ] **Step 2: Rodar** `npm test -- store` e confirmar que falha.

- [ ] **Step 3: Implementar** `store.ts`, depois `api.ts`, `ipc.ts`, o preload e as tipagens. Por enquanto `ensureMic` e `transcribe` lançam `new Error('not implemented')`; o Task 6 preenche.

- [ ] **Step 4: Rodar** `npm test` e `npm run typecheck`. Esperado: tudo passa.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: atomic state store, profiles and IPC contract"`

---

### Task 6: Gravar a fala e transcrever com Whisper

**Files:**
- Create: `src/shared/wav.ts`, `src/main/speech/whisper.ts`, `src/renderer/src/audio/recorder.ts`, `tests/fixtures/age.wav`
- Modify: `src/main/ipc.ts` (`ensureMic`, `transcribe`), `src/main/index.ts` (handler de permissão de mídia)
- Test: `tests/shared/wav.test.ts`, `tests/main/whisper.test.ts`

**Interfaces:**
- Produces:

```ts
// wav.ts
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array   // PCM16 mono, valores fora de [-1,1] são cortados

// whisper.ts — importa TranscribeResult de src/shared/api.ts (Task 5)
export type Runner = (bin: string, args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>  // rejeita com code 'ENOENT' se não achar o binário
export function cleanWhisperOutput(stdout: string): string
export function createWhisperTranscriber(o: { bin: string; model: string; run?: Runner; exists?: (path: string) => boolean }): { transcribe(wavPath: string): Promise<TranscribeResult> }

// recorder.ts (renderer)
export type Recorder = { stop(): Promise<Float32Array> }
export function startRecording(maxSeconds?: number /* padrão 30, para sozinho */): Promise<Recorder>   // 16 kHz mono
```

Argumentos do whisper: `['-m', model, '-f', wavPath, '-l', 'en', '-nt', '-np']`. O `cleanWhisperOutput` remove `[BLANK_AUDIO]`, qualquer `[...]` ou `(...)` (como `(music)`), timestamps, junta as linhas e apara as pontas. *shortcut:* `bin` vem de `process.env.WHISPER_BIN ?? 'whisper-cli'` e `model` de `process.env.WHISPER_MODEL ?? ~/.cache/whisper/ggml-small.bin`, só no Mac de desenvolvimento; o Plano 2 troca por modelos gerenciados. O handler `transcribe` grava os bytes em `os.tmpdir()/ingles-<randomUUID>.wav`, transcreve e apaga o arquivo num `finally`. O `ensureMic` usa `systemPreferences.askForMediaAccess('microphone')` no macOS e devolve `true` nos outros sistemas. No main, `session.defaultSession.setPermissionRequestHandler` libera só a permissão `'media'`. O recorder usa `getUserMedia` com `AudioContext({ sampleRate: 16000 })` e um `ScriptProcessorNode` (*shortcut:* nó deprecado, mas não esbarra na CSP do template; trocar por AudioWorklet se o Chromium remover o nó).

- [ ] **Step 1: Gerar a fixture de áudio** (com a voz do macOS e o ffmpeg)

```bash
say -o /tmp/age.aiff "I am twenty five years old" && ffmpeg -y -loglevel error -i /tmp/age.aiff -ar 16000 -ac 1 tests/fixtures/age.wav
```

- [ ] **Step 2: Escrever os testes que falham**

```ts
// wav.test.ts
test('encodeWav writes a valid 16-bit mono header and clips', () => {
  const b = encodeWav(new Float32Array([0, 1, -1, 2]), 16000); const v = new DataView(b.buffer)
  expect(new TextDecoder().decode(b.slice(0, 4))).toBe('RIFF'); expect(new TextDecoder().decode(b.slice(8, 12))).toBe('WAVE')
  expect(v.getUint32(24, true)).toBe(16000); expect(v.getUint16(34, true)).toBe(16); expect(v.getUint32(40, true)).toBe(8)
  expect(v.getInt16(50, true)).toBe(32767); expect(v.getInt16(52, true)).toBe(-32768); expect(v.getInt16(54, true)).toBe(32767)
})
// whisper.test.ts
test('cleanWhisperOutput drops blank/noise markers', () => {
  expect(cleanWhisperOutput(' [BLANK_AUDIO]\n')).toBe(''); expect(cleanWhisperOutput(' Hello there.\n (music)\n How are you?')).toBe('Hello there. How are you?')
})
test('missing binary → no-binary')        // run rejeita com Object.assign(new Error(), { code: 'ENOENT' })
test('missing model → no-model, without calling run')
test('non-zero exit → failed with stderr in message')
test('success returns cleaned text')
test.skipIf(!hasWhisperAndModel)('real whisper transcribes the fixture', async () => {
  const r = await createWhisperTranscriber({ bin: 'whisper-cli', model: defaultModel }).transcribe(fixture('age.wav'))
  expect(r.ok && checkAnswer(r.text, { accepted: ['I am twenty-five years old'], commonErrors: [] }).verdict).toBe('correct')
})
```

- [ ] **Step 3: Rodar** `npm test -- wav whisper` e confirmar que falha.

- [ ] **Step 4: Implementar** `wav.ts`, `whisper.ts`, os handlers IPC, o handler de permissão e o `recorder.ts`.

- [ ] **Step 5: Rodar** `npm test`. Esperado: tudo passa, incluindo o teste com o Whisper de verdade neste Mac.

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: microphone capture, WAV encoding and whisper transcription"`

---

### Task 7: Modo solo (telas)

**Files:**
- Create: `src/renderer/src/screens/ProfilesScreen.tsx`, `HomeScreen.tsx`, `SessionScreen.tsx`, `SummaryScreen.tsx`; `src/renderer/src/components/ExerciseView.tsx`, `RecordButton.tsx`, `ResultView.tsx`; `src/renderer/src/audio/speak.ts`
- Modify: `src/renderer/src/App.tsx` (trocar o conteúdo do template), CSS do template

**Interfaces:**
- Consumes: `window.api` (Tasks 5 e 6), `buildSession`, `DURATIONS` e as funções de progresso (Task 4), `checkAnswer` e `toFinalVerdict` (Task 3), `findExercise` e `availableLevels` (Task 2), `startRecording` e `encodeWav` (Task 6).
- Produces: `SessionScreen` com as props `{ mode: Mode; course: Course; progress: ProfileProgress; minutes: Duration; onProgress(p: ProfileProgress): void; onEnd(record: SessionRecord): void }`. O Task 8 acrescenta o comportamento do modo guiado nele. `ResultView` com as props `{ result: CheckResult; transcript: string; mode: Mode; onFinal(v: FinalVerdict): void }`. `speak(text: string): void`.

O comportamento que as telas precisam ter:
- **Perfis:** lista e cria perfis. No perfil novo, a pessoa escolhe o nível inicial entre os de `availableLevels(course)`. *Shortcut:* é escolha manual até o Plano 4 trazer o nivelamento.
- **Início:** mostra o nome do perfil, a unidade e o nível atuais, a escolha de modo (Solo/Guiado) e os botões 10–60. Se `loadState` devolveu `recoveredFrom`, mostra um aviso em português com o caminho do backup.
- **Sessão:** percorre os `steps`. A revisão mostra os exercícios de `exerciseIds` resolvidos com `findExercise`.
- **Exercícios de clicar ou digitar** (`ExerciseView` renderiza cada tipo):
  - `choice`: botões de opção, com botão de ouvir quando há `listen`;
  - `fill`: a frase com um campo de texto no lugar do `___`;
  - `order`: as palavras de `accepted[0]` embaralhadas, em botões que vão sendo clicados para montar a frase, com opção de desfazer;
  - `match`: duas colunas para ligar os pares, com a coluna do português embaralhada.

  Todos são conferidos com a função `check*` correspondente e depois mostram o `ResultView`.
- **Exercício falado:** botão para ouvir (`speak(listen ?? prompt)`), botão para gravar, transcrição, depois `checkAnswer` e por fim `ResultView`. `unclear` mostra "Não entendi, tente de novo" e não registra nada. Vocab: mostra o cartão e pede para repetir `word_en` e `example_en`, que é tratado como `repeat` com `accepted: [example_en]`. FreeSpeak: grava, mostra a transcrição e as `guidelines_pt` como checklist, e quem marca é a própria pessoa (*shortcut:* o Plano 2 traz o modelo de texto).
- **Veredito final:** o `ResultView` mostra o veredito, a `explanation_pt`, a `correction_en` e o diff. Também tem o botão "Acho que acertei", que transforma em `correct` (na dúvida, aceitar). Cada veredito final chama `recordAttempt` e salva na hora. Terminar os exercícios de um bloco chama `completeBlock` e salva.
- **Tempo:** um contador mostra quanto falta e nunca encerra sozinho. "Encerrar sessão" está sempre disponível e chama `recordSession` com o que foi feito.
- **Microfone:** se `ensureMic()` devolver false, se `getUserMedia` falhar ou se `transcribe` devolver `ok: false`, aparece uma mensagem em português ("Não consegui acessar o microfone…" / "A transcrição não está disponível…") e os botões "Marcar como certo" e "Marcar como errado", para a sessão seguir.
- **Resumo:** blocos feitos, erros da sessão e onde começa a próxima.
- **`speak`:** usa `speechSynthesis` com uma voz `en-US`. *Shortcut:* o Plano 5 troca pelos áudios embutidos quando `audio` existir.

- [ ] **Step 1: Implementar as telas e os componentes** conforme acima. Sem teste automatizado de interface; a lógica já está coberta pelos Tasks 2 a 6.

- [ ] **Step 2: Verificar na mão com `npm run dev`:**
  - criar o perfil "Teste" no A1;
  - fazer uma sessão solo de 10 min;
  - no exercício da idade, dizer "I have 25 years" e conferir que aparece a explicação em português;
  - dizer "I'm 25 years old" e conferir que dá `correct`;
  - ficar em silêncio e conferir "Não entendi" sem registrar erro;
  - fechar o app no meio da sessão, abrir de novo e conferir que o progresso e o erro continuam lá, e que a sessão seguinte começa com a revisão;
  - negar o microfone (Ajustes → Privacidade → Microfone) e conferir que a mensagem e a marcação manual aparecem.

- [ ] **Step 3: Rodar** `npm test && npm run typecheck && npm run lint`. Esperado: tudo passa.

- [ ] **Step 4: Commit** `git add -A && git commit -m "feat: solo mode screens with speech correction"`

---

### Task 8: Modo guiado

**Files:**
- Create: `src/renderer/src/components/TeacherPanel.tsx`, `SoloRecap.tsx`, `PhaseTimer.tsx`
- Modify: `src/renderer/src/screens/SessionScreen.tsx`, `src/renderer/src/components/ResultView.tsx`

**Interfaces:**
- Consumes: `SessionScreen` e `ResultView` (Task 7), `soloSinceLastGuided` (Task 4).

O comportamento quando `mode === 'guided'`:
- **Sem IA nem microfone:** nos exercícios falados (`repeat`, `translate`, `listen_answer`, `vocab`, `free_speak`) não há botão de gravar nem chamada a `ensureMic` ou `transcribe`. Aparecem o enunciado, o botão de ouvir e os botões "Professor: certo" e "Professor: errado". Esse veredito vai direto para `recordAttempt`, com `transcript: ''`. Os exercícios de clicar ou digitar funcionam igual ao solo.
- **Resumo do solo:** antes do primeiro passo aparece o `SoloRecap`, com o que a pessoa fez sozinha desde a última aula guiada (sessões, blocos e erros pendentes) e o botão "Começar aula". Se não houver nada, o resumo não aparece.
- **Cola do professor:** o `TeacherPanel` fica **fechado por padrão** e abre pelo botão "Mostrar cola do professor". Mostra `goal_pt`, `prompts` e `watchFor` do bloco atual, e as `accepted` e `commonErrors` do exercício atual. Fecha de novo ao mudar de exercício.
- **Tempo por fase:** o `PhaseTimer` mostra o nome da fase em português, o tempo restante dela (`step.minutes`) e o tempo restante da sessão. Nunca avança sozinho.
- **Veredito:** o `ResultView` mostra "Professor: certo" e "Professor: errado", e o veredito escolhido vira o final, valendo mais que o automático. No FreeSpeak, quem marca é quem ensina.
- **Sessão:** ao terminar, é gravada com `mode: 'guided'`.

- [ ] **Step 1: Implementar** os três componentes e os ajustes conforme acima.

- [ ] **Step 2: Verificar na mão com `npm run dev`:**
  - fazer uma sessão solo de 10 min com um erro e encerrar;
  - abrir uma sessão guiada de 20 min no mesmo perfil e conferir que o resumo mostra a sessão solo e o erro;
  - conferir que a cola começa fechada, abre pelo botão e fecha ao trocar de exercício;
  - conferir que nenhum exercício falado mostra o botão de gravar e que o macOS não pede o microfone;
  - errar de propósito uma múltipla escolha, apertar "Professor: certo" e conferir no resumo final que conta como acerto;
  - marcar "Professor: errado" num exercício falado e conferir que ele aparece na revisão da próxima sessão solo;
  - conferir que o tempo da fase e o da sessão diminuem.

- [ ] **Step 3: Rodar** `npm test && npm run typecheck && npm run lint`. Esperado: tudo passa.

- [ ] **Step 4: Commit** `git add -A && git commit -m "feat: guided mode with teacher panel, phase timer and solo recap"`
