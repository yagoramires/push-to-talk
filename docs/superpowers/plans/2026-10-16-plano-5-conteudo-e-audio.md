# Plano 5 — Conteúdo do curso A1–C1 e áudios (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o curso completo, com 12 unidades por nível de A1 a C1 (60 no total) e as provas de nível de A2 a C1, e trocar o `speechSynthesis` por áudios gerados durante a construção com uma voz sintética local e grátis, que vão embutidos no app.

**Architecture:** Os áudios são identificados pelo texto falado, e não por um campo do exercício. Uma função pura em `src/shared` lista os textos que cada exercício toca, e ela é usada tanto pela tela quanto pelo gerador. O gerador (script de build com `kokoro-js` e `ffmpeg`) cria `content/audio/<hash>.mp3` e um `content/audio/index.json` (texto → arquivo). O loader lê o índice e põe em `course.audio`. O main serve os arquivos pelo protocolo `course-audio://`. O `ListenButton` toca o arquivo quando ele existe e cai no `speechSynthesis` quando não existe. O conteúdo é escrito nível por nível, e um teste sobre o conteúdo real garante a estrutura.

**Tech Stack:** `kokoro-js@1.2.1` (Apache-2.0, só em devDependencies, roda no Node), `ffmpeg` (só na máquina de quem constrói), zod e Vitest como já existem.

**Spec:** `docs/superpowers/specs/2026-10-15-app-ingles-design.md` (seções "Estrutura do curso", "Tipos de exercício", "O que seria um fracasso").

## Global Constraints

- **Volume:** 12 unidades por nível, de A1 a C1, com `order` de 1 a 12. Os ids seguem `a1-03-…` e assim por diante. As unidades `a1-01` e `a1-02` já existem e ficam como estão.
- **Blocos de cada unidade, nesta ordem:** `warmup`, `vocabulary`, `pronunciation`, `listening`, `conversation`, `review`. O de conversação termina com um `free_speak`. Os minutos seguem os das unidades existentes (cerca de 27 min por unidade).
- **Foco em conversação:** pelo menos metade dos exercícios de cada unidade são falados (`repeat`, `translate`, `listen_answer`, `free_speak`, `vocab`).
- **Respostas aceitas:** várias formas corretas, com contrações e variações naturais. Na dúvida, aceitar.
- **Erros comuns de brasileiros:** cada `translate` e cada `listen_answer` tem pelo menos 1 `commonError` com explicação.
- **Idioma das instruções e explicações:**
  - A1 e A2: tudo em português;
  - B1: instruções em português, com o enunciado em inglês quando fizer sentido; explicações em português;
  - B2: instruções em inglês simples, explicações em português;
  - C1: instruções e explicações em inglês.
  Os campos continuam com o nome `instruction_pt` e `explanation_pt`; o sufixo é só o nome do campo.
- **Provas de nível:** `exam-a2.json` até `exam-c1.json`, no formato do Plano 4 (4 partes, ao menos 4 exercícios cada, 20 a 30 minutos). Os itens apontam `unitId` para as unidades do nível.
- **Temas** (título em inglês; a unidade decide o recorte):
  - **A1:** 03 Family, 04 Daily routine, 05 Food and drinks, 06 At the café, 07 Home and furniture, 08 Telling the time, 09 Clothes and colors, 10 Shopping, 11 Weather, 12 Free time;
  - **A2:** 01 Past weekend, 02 Directions in town, 03 At the restaurant, 04 Travel and transport, 05 Health and the doctor, 06 Work and jobs, 07 Plans for the future, 08 Phone calls, 09 Hotel check-in, 10 Describing people, 11 Comparing things, 12 Making invitations;
  - **B1:** 01 Talking about experiences, 02 Job interviews, 03 Complaints and problems, 04 Giving advice, 05 Movies and series, 06 News and events, 07 Technology in daily life, 08 Money and banking, 09 Environment, 10 Telling a story, 11 Agreeing and disagreeing, 12 Small talk at work;
  - **B2:** 01 Meetings, 02 Presenting ideas, 03 Negotiating, 04 Hypotheticals, 05 Workplace conflicts, 06 Culture and travel, 07 Opinions on society, 08 Customer service, 09 Explaining processes, 10 Reported speech in conversation, 11 Idioms in context, 12 Persuasion;
  - **C1:** 01 Nuance and hedging, 02 Debating, 03 Formal vs informal register, 04 Storytelling with detail, 05 Abstract topics, 06 Leading a discussion, 07 Handling difficult conversations, 08 Humor and irony, 09 Phrasal verbs in fluent speech, 10 Professional networking, 11 Giving feedback, 12 Summarizing and paraphrasing.
- **Voz:** kokoro, voz `af_heart`, gerada como MP3 mono a 48 kbps. Os áudios vão para o git, para que o build não precise do modelo de voz.
- **Fallback:** sem arquivo de áudio para um texto, o app usa o `speechSynthesis`, como hoje. Nunca fica mudo nem quebra.

## Review Focus

1. **Texto do áudio diferente do texto na tela** (o conteúdo foi editado depois de gerar o áudio): o hash muda, o índice não tem o texto novo e o app cai no `speechSynthesis`, em vez de tocar o áudio antigo. O teste de conteúdo real acusa os textos sem áudio. Coberto no Task 1.
2. **Índice apontando para um arquivo que não existe:** o loader falha com `ContentError` e o nome do arquivo, em vez de o botão ficar mudo. Teste no Task 1.
3. **Áudio no app empacotado** (caminho com acento, `resourcesPath`): o protocolo `course-audio://` lê do mesmo `contentDir` que o loader usa e recusa nomes fora da pasta, como `..` ou `/`. Teste no Task 1.
4. **Resposta certa recusada:** uma pessoa que fala uma forma natural que não está em `accepted`. Cada task de conteúdo revisa as respostas aceitas pensando em contrações, ordem alternativa e sinônimos comuns, e o relatório lista 3 exemplos de variações aceitas.
5. **Gabarito aparecendo no modo guiado antes da hora:** só os campos existentes são usados, e o painel do professor continua igual (Plano 1). Nenhum campo novo de conteúdo é criado.

---

### Task 1: Áudios embutidos (gerador, índice, protocolo e ListenButton)

**Files:**
- Create: `src/shared/listen.ts`, `scripts/generate-audio.mjs`, `src/main/audio-protocol.ts`, `tests/shared/listen.test.ts`, `tests/main/audio-protocol.test.ts`, `tests/content/real-content.test.ts`, `content/audio/` (gerado)
- Modify: `src/shared/content.ts` (remove os campos `audio` que não são usados; acrescenta `audio: Record<string, string>` ao `Course`), `src/main/content/load-course.ts`, `src/main/index.ts`, `src/renderer/src/components/ExerciseView.tsx`, `src/renderer/src/components/ListenButton.tsx`, `src/renderer/src/audio/speak.ts`, `package.json`, `tests/fixtures/course.ts`

**Interfaces:**
- Produces:
  - `listenTexts(ex: Exercise | AssessmentItem): string[]` em `src/shared/listen.ts`. Devolve os textos que o `ExerciseView` passa ao `ListenButton` hoje: vocab → `` `${word_en}. ${example_en}` ``; free_speak → `prompt_en`; os de `listen` → `listen`; e o caso `listenText` que existe hoje no `ExerciseView`. O `ExerciseView` passa a usar essa função, e não fica nenhuma lógica duplicada.
  - `audioFile(text: string): string` = os 16 primeiros caracteres hex do sha1 de `text.trim()` + `.mp3`, em `src/main/content/load-course.ts` ou num módulo do main reaproveitado pelo script.
  - `content/audio/index.json`: `Record<string, string>` (texto → arquivo). O loader valida o índice, confere que cada arquivo existe (senão lança `ContentError` com o nome do arquivo) e preenche `course.audio`.
  - `registerAudioProtocol(contentDir: string)`: o scheme `course-audio` é registrado como privilegiado antes do `ready`, com `protocol.handle` servindo `contentDir/audio/<nome>`. O nome precisa casar com `/^[0-9a-f]{16}\.mp3$/`, senão a resposta é 404. Para o teste, a função pura `audioPathFor(contentDir, url): string | null` fica exportada.
  - `ListenButton({ text })`: lê `course.audio` por um contexto React `AudioIndexContext`, que o `App` fornece. Com o arquivo, toca `new Audio('course-audio://audio/<arquivo>')`. Sem o arquivo, ou se o `play()` rejeitar, chama o `speak(text)`. Remover o comentário `shortcut:` de `speak.ts`.
  - `npm run audio` → `node scripts/generate-audio.mjs`. O script lê `content/units/*.json` e `content/assessments/*.json`, junta os textos com `listenTexts`, gera só os que faltam (incremental), remove do índice e do disco os que ninguém usa mais e regrava o `index.json` ordenado. Para importar o `listenTexts` (TypeScript), o script pode rodar com `node --experimental-strip-types`, que funciona no Node 24, ou repetir a regra. Se repetir, o teste de conteúdo real pega a divergência.
- [ ] **Step 1: Testes que falham:**
  - `tests/shared/listen.test.ts`: um caso por tipo de exercício, com os textos esperados.
  - `tests/main/audio-protocol.test.ts`: `audioPathFor('/c', 'course-audio://audio/0123456789abcdef.mp3')` → `/c/audio/0123456789abcdef.mp3`; com `..%2F..%2Fx`, com nome sem `.mp3` ou com hex curto → `null`.
  - Teste do loader (no arquivo de teste existente): o índice aponta para um arquivo ausente → `ContentError` que cita o arquivo; sem `index.json` → `course.audio` é `{}`.
  - `tests/content/real-content.test.ts`, que carrega o curso real em `content/`:
    - cada nível que tem unidades tem exatamente 12, com `order` de 1 a 12 sem repetição;
    - toda unidade tem os 6 blocos na ordem das Global Constraints, e o de conversação termina com `free_speak`;
    - pelo menos metade dos exercícios de cada unidade é falada;
    - todo `translate` e todo `listen_answer` tem pelo menos 1 `commonError`;
    - todo nível com unidades tem prova, menos quando o nível está vazio;
    - todo texto de `listenTexts` do curso inteiro está em `course.audio`.
    Enquanto o conteúdo não estiver todo pronto, os níveis sem unidades são pulados, e não falham.
- [ ] **Step 2:** Rodar `npm test`. Esperado: os testes novos falham.
- [ ] **Step 3:** Implementar. Instalar o `kokoro-js@1.2.1` como devDependency. O gerador usa `KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8' })`, grava WAV temporário e converte com `ffmpeg -ac 1 -b:a 48k`. Se faltar o `ffmpeg`, o script falha com a mensagem "instale o ffmpeg (brew install ffmpeg)".
- [ ] **Step 4:** Rodar `npm run audio` para o conteúdo que já existe (unidades A1 01–02, nivelamento e prova do A1). Esperado: os arquivos aparecem em `content/audio/` e `npm test` passa, incluindo o teste de conteúdo real. Registrar no relatório o tamanho total de `content/audio/`.
- [ ] **Step 5:** Rodar `typecheck`, `lint`, `build` e `npm run dev` por cerca de 20 s, sem erros.
- [ ] **Step 6:** Commit `feat: bundled synthetic-voice audio with speechSynthesis fallback`.

---

### Tasks 2–6: Conteúdo por nível

Um task por nível: **Task 2 = A1** (unidades 03–12; a prova do A1 já existe), **Task 3 = A2**, **Task 4 = B1**, **Task 5 = B2**, **Task 6 = C1**. Os níveis A2 a C1 trazem as 12 unidades e a `content/assessments/exam-<nível>.json`.

**Files:** `content/units/<nível>-NN-<slug>.json`, `content/assessments/exam-<nível>.json` (A2–C1), `content/audio/*` (gerados)

**Interfaces:**
- Consumes: o schema de unidade e de prova (`src/shared/content.ts`), as Global Constraints deste plano e as unidades `a1-01`/`a1-02` como modelo de estilo e profundidade.

Passos de cada task:
- [ ] **Step 1:** Ler as unidades do nível anterior (ou as `a1-01`/`a1-02` no Task 2) para manter a progressão. O vocabulário e a gramática de uma unidade podem usar só o que veio antes, mais o alvo dela.
- [ ] **Step 2:** Escrever as 12 unidades com os temas das Global Constraints, e a prova quando houver. O nível de dificuldade segue o CEFR do nível. Cada unidade tem um `objective_pt` concreto ("pedir um prato e perguntar o preço"). Os erros comuns são os de brasileiros: falso cognato, tradução literal, preposição, pronúncia de "th", vogal extra, "-ed".
- [ ] **Step 3:** Rodar `npx vitest run tests/content/real-content.test.ts tests/main/load-course.test.ts`. Esperado: passa, sem contar o áudio.
- [ ] **Step 4:** Rodar `npm run audio` e depois `npm test`, `npm run typecheck` e `npm run lint`. Esperado: tudo passa.
- [ ] **Step 5:** Commit `content: <NÍVEL> units<, exam>` (por exemplo, `content: A2 units and exam`).
- O relatório lista:
  - os 12 títulos;
  - 3 exemplos de variações aceitas que pegariam uma resposta natural;
  - o tamanho do áudio novo.
