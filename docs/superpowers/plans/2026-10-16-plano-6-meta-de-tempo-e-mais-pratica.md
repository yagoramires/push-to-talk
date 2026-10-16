# Plano 6 — Meta de tempo e mais prática (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pessoa escolhe um nível alvo e um prazo (1, 3, 6 ou 12 meses), e o app calcula quantos minutos por dia ela precisa estudar, avisa com honestidade quando a meta não é realista e acompanha o tempo de cada dia. O material também cresce: cada unidade ganha um banco de prática extra e diálogos de role-play, e um modo "Praticar mais" usa esse banco com repetição espaçada, para que sempre haja o que estudar dentro da meta diária.

**Architecture:**
- A conta da meta é pura e fica em `src/shared/goal.ts`. Ela usa as horas de estudo guiado por nível (estimativa do Cambridge) e o tempo real já gravado em `SessionRecord.minutes`.
- O progresso ganha `goal` e `practice` (as caixas de Leitner).
- O conteúdo ganha:
  - `practice: Exercise[]` em cada unidade;
  - o tipo de exercício `dialogue` (falas do parceiro em áudio, falas da pessoa checadas pelo matcher que já existe).
- O `buildPracticeSession` monta sessões só com o banco de prática das unidades já feitas.

**Tech Stack:** o mesmo dos Planos 1–5. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-10-15-app-ingles-design.md`, mais o pedido do usuário em 2026-10-16:
- "aprimorar o material de estudo, acrescentar mais material, mais exercícios";
- "um plano de tempo: você tem 1 mês, então tem que fazer 1 h por dia, 3 meses, 6 meses etc."

## Global Constraints

- **Horas acumuladas para terminar cada nível**, a partir do zero (`LEVEL_HOURS`; estimativa de horas de estudo guiado do Cambridge): A1 100, A2 200, B1 400, B2 600, C1 800. Na tela, a fonte aparece como "estimativa do Cambridge para horas de estudo guiado".
- **Horas que faltam:** `LEVEL_HOURS[alvo] − LEVEL_HOURS[nível anterior ao atual]`, menos as horas já estudadas no app desde que a meta foi criada. O nível anterior ao A1 vale 0.
- **Prazos:** 1, 3, 6 e 12 meses. Um mês tem 30 dias.
- **Dias de estudo por semana:** 5, 6 ou 7. O padrão é 6.
- **Minutos por dia** = horas que faltam × 60 ÷ (semanas do prazo × dias por semana), arredondado para cima de 5 em 5.
- **Faixas de viabilidade** (usam os minutos por dia calculados):
  - até 60 → `ok`;
  - de 61 a 120 → `puxado`: "Dá, mas é puxado.";
  - acima de 120 → `irreal`: "Essa meta pede mais de 2 horas por dia." A tela sugere o menor prazo da lista que caiba em 60 min por dia, ou "nenhum prazo da lista" quando nem 12 meses cabem.
- **Honestidade:** o app tem muito menos horas de aula do que as horas da meta. A tela diz, com estas palavras: "As aulas do app cobrem parte disso. O resto vem da prática extra, da revisão e do inglês fora do app: séries, música, conversas." O texto não promete fluência.
- **Tempo estudado:** é a soma de `SessionRecord.minutes`, contando as aulas, a prática, as provas e o nivelamento. Os registros de prova e de nivelamento também passam a gravar `minutes`. O dia é a data local do `at`.
- **Prática extra por unidade:** de 24 a 32 exercícios em `practice`, com pelo menos 60% falados. Cada unidade tem pelo menos 1 `dialogue`, que pode estar nos blocos ou na prática, com 3 a 6 turnos da pessoa.
- **Repetição espaçada:** caixas de Leitner de 1 a 5, com intervalos em dias de 0, 1, 3, 7 e 14.
  - Acerto: sobe uma caixa, até a 5.
  - "Quase": continua na mesma caixa.
  - Erro: volta para a caixa 1.
  - Um exercício está pronto quando `hoje >= ultimaVez + intervalo[caixa]`.
- **Modo guiado:** a meta e a prática funcionam nele. No diálogo guiado, quem ensina lê a fala do parceiro ou toca o áudio e marca as falas da pessoa, como já acontece nos outros exercícios.
- **Textos:** em português. O idioma das instruções segue a regra por nível do Plano 5.

## Review Focus

1. **Meta criada e depois o nível muda** (a pessoa passa na prova): o cálculo usa o nível atual na hora, e não o da criação, e a meta já alcançada mostra "Meta alcançada!". Teste no Task 1.
2. **Dias sem estudo ou estudo além do previsto:** os minutos de hoje e da semana somam só as sessões do dia ou da semana local. Uma sessão que atravessa a meia-noite conta no dia em que terminou. O ritmo projetado usa a média dos últimos 14 dias, e uma pessoa sem histórico não divide por zero. Teste no Task 1.
3. **"Praticar mais" sem nenhuma unidade feita**, ou com tudo em dia: o botão não aparece, ou a sessão traz os itens pendentes mais antigos, sem ficar vazia e sem travar. Teste no Task 3.
4. **Diálogo com a fala da pessoa mal transcrita:** cada turno tem o "Acho que acertei" e a marcação manual, como nos outros exercícios, e um turno errado não bloqueia os próximos. O diálogo conta como acerto quando ao menos 70% dos turnos estão certos. Teste no Task 2.
5. **Progresso salvo antes deste plano** (sem `goal`, sem `practice`, sessões sem os novos registros): carrega pelo `migrateProgress`, com `goal: null` e `practice: {}`. Teste no Task 1.

---

### Task 1: Meta de tempo (lógica, progresso e telas)

**Files:**
- Create: `src/shared/goal.ts`, `tests/shared/goal.test.ts`, `src/renderer/src/screens/GoalScreen.tsx`, `src/renderer/src/components/TodayGoal.tsx`
- Modify: `src/shared/progress.ts` (`goal`, `migrateProgress`), `src/renderer/src/App.tsx`, `src/renderer/src/screens/HomeScreen.tsx`, `src/renderer/src/screens/PlacementScreen.tsx` (depois do resultado, oferecer "Definir minha meta"), `src/renderer/src/screens/ExamScreen.tsx` (gravar um `SessionRecord` com `minutes`), o CSS e `tests/shared/progress.test.ts`

**Interfaces:**
- Produces:
  - `type Goal = { target: Level; months: 1 | 3 | 6 | 12; daysPerWeek: 5 | 6 | 7; createdAt: string }` e `ProfileProgress.goal: Goal | null`.
  - `const LEVEL_HOURS: Record<Level, number>`.
  - `planGoal(o: { level: Level; target: Level; months: Goal['months']; daysPerWeek: Goal['daysPerWeek']; studiedMinutes: number }): { hoursLeft: number; minutesPerDay: number; feasibility: 'ok' | 'puxado' | 'irreal' | 'alcancada'; suggestedMonths: Goal['months'] | null }`. O `studiedMinutes` são os minutos desde `createdAt`.
  - `studyStats(sessions: SessionRecord[], now: Date): { todayMinutes: number; weekMinutes: number; avgPerDay14: number; streakDays: number }`. Datas locais; a semana começa na segunda-feira.
  - `projectedFinish(hoursLeft: number, avgPerDay14: number, now: Date): Date | null`, que dá `null` quando a média é 0.
- [ ] **Step 1: Testes que falham** em `tests/shared/goal.test.ts`:
  - `planGoal({ level: 'A2', target: 'B1', months: 6, daysPerWeek: 6, studiedMinutes: 0 })`:
    - `hoursLeft` 300 (400 − 100);
    - `minutesPerDay` = `ceil5(300×60 ÷ (180/7 × 6))` = 120;
    - `feasibility` `puxado`.
  - O mesmo com `months: 1` dá:
    - `minutesPerDay` 700 (300×60 ÷ (30/7 × 6) = 700);
    - `feasibility` `irreal`;
    - `suggestedMonths` 12, porque 12 meses dá `ceil5(58,3)` = 60, 6 meses dá 120 e 3 meses dá 235.
  - Com `level: 'A1'`, `target: 'C1'` e `months: 12`: `hoursLeft` 800, `minutesPerDay` 160, `irreal` e `suggestedMonths` `null`.
  - `level: 'A1'`, `target: 'A1'`, `months: 3` → `hoursLeft` 100.
  - `level: 'B2'`, `target: 'B1'` (já passou) → `feasibility` `alcancada` e `minutesPerDay` 0.
  - `studiedMinutes` de 6000 abate 100 horas.
  - `studyStats`:
    - sessões de ontem e de hoje (incluindo uma às 23:50 de ontem com 20 min) somam certo em hoje e na semana;
    - sem sessões, tudo dá 0 e não aparece `NaN`;
    - o `streakDays` conta dias seguidos até hoje (ou até ontem, quando hoje ainda está vazio).
  - `projectedFinish` com média 0 → `null`.
  - Em `tests/shared/progress.test.ts`, o `migrateProgress` sem `goal` → `goal: null`.
- [ ] **Step 2:** Rodar `npx vitest run tests/shared/goal.test.ts tests/shared/progress.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `goal.ts` e os campos novos do progresso. Rodar os testes. Esperado: PASS.
- [ ] **Step 4: Telas:**
  - `GoalScreen` (entra pelo Home em "Minha meta" e depois do nivelamento):
    - escolhe o nível alvo entre os níveis acima do atual, o prazo e os dias por semana;
    - mostra ao vivo os minutos por dia, a faixa, o texto de honestidade das Global Constraints e a sugestão de prazo quando a meta for `irreal`;
    - tem os botões "Salvar meta" e "Agora não".
  - `TodayGoal`, no topo do Home:
    - "Hoje: X de Y min" e "Semana: X de Y min" (Y semanal = minutesPerDay × daysPerWeek), cada um com barra de progresso; quando a semana já fechou a meta, "Meta da semana cumprida!";
    - a sequência de dias;
    - "No seu ritmo, você chega ao <alvo> em <mês/ano>" (ou "Estude alguns dias para ver a previsão");
    - quando `minutesPerDay` > 60, a frase "Faça duas sessões hoje".
  - A duração pré-selecionada no Home passa a ser o `DURATION` mais próximo de `min(minutesPerDay restantes hoje, 60)`.
- [ ] **Step 5:** Rodar `npm test`, `typecheck`, `lint` e `build`. Commit `feat: study goal with honest minutes-per-day plan and daily tracking`.

---

### Task 2: Exercício `dialogue` (role-play)

**Files:**
- Modify: `src/shared/content.ts` (`DialogueSchema` na união, com `dialogue` entrando em `SPOKEN_KINDS`), `src/shared/listen.ts`, `src/renderer/src/components/ExerciseView.tsx`, `src/renderer/src/components/TeacherPanel.tsx` (se mostrar o gabarito), o CSS, `tests/fixtures/course.ts` e os testes de content, listen e matcher
- Create: `src/renderer/src/components/DialogueView.tsx`, `src/shared/dialogue.ts`, `tests/shared/dialogue.test.ts`

**Interfaces:**
- Produces:
  - `DialogueSchema`:
    - `{ id, kind: 'dialogue', instruction_pt, scene_pt, turns: Turn[] }`, com `turns` de 2 a 12 itens;
    - `Turn = { speaker: 'partner'; text: string } | { speaker: 'you'; cue_pt: string; accepted: string[]; commonErrors: CommonError[] }`;
    - de 3 a 6 turnos `you`, e o primeiro turno é do `partner`.
  - `listenTexts` de um `dialogue` → os `text` dos turnos `partner`. Assim o gerador de áudio cobre essas falas sem mudança.
  - `dialogueVerdict(results: FinalVerdict[]): FinalVerdict`: dá `correct` quando acertos ≥ 70% dos turnos `you`, e `error` nos outros casos. A entrada no `errorLog` é feita pelo id do diálogo.
  - `DialogueView`: mostra o histórico em balões (o parceiro à esquerda com o `ListenButton`, a pessoa à direita). Em cada turno `you`, mostra o `cue_pt` e o `SpokenAnswer` com `check = { accepted, commonErrors }`. O modo guiado usa a marcação do professor, como o `SpokenAnswer` já faz. No fim chama `onFinal(dialogueVerdict(...))`. Funciona com `exam` igual aos outros tipos.
- [ ] **Step 1: Testes que falham:**
  - o schema recusa diálogo que começa com `you`, que tem 2 turnos `you` ou que tem `accepted` vazio;
  - `listenTexts` devolve só as falas do parceiro;
  - `dialogueVerdict` com 3 acertos em 4 → `correct`, com 2 em 4 → `error`, e com `almost` contando como acerto.
- [ ] **Step 2:** Rodar os testes. Esperado: FAIL. Implementar. Rodar de novo. Esperado: PASS.
- [ ] **Step 3:** Acrescentar 1 diálogo no fixture e conferir que `npm test`, `typecheck`, `lint` e `build` passam. Commit `feat: dialogue role-play exercise`.

---

### Task 3: Banco de prática e "Praticar mais" com repetição espaçada

**Files:**
- Create: `src/shared/practice.ts`, `tests/shared/practice.test.ts`
- Modify: `src/shared/content.ts` (`UnitSchema.practice: Exercise[]`, opcional, com padrão `[]`, e os ids únicos entre os blocos e a prática), `src/main/content/load-course.ts` (a checagem de ids), `src/shared/content.ts` `findExercise` (acha os itens de prática), `src/shared/progress.ts` (`practice: Record<string, { box: 1|2|3|4|5; last: string }>` e `migrateProgress`), `src/renderer/src/screens/HomeScreen.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/screens/SessionScreen.tsx` (aceita um plano pronto) e `tests/content/real-content.test.ts` (as regras de prática e de diálogo, que ficam ativas só depois do Task 4: deixar `it.todo` não vale; usar `<=` agora e o Task 4 aperta, como no Plano 5)

**Interfaces:**
- Produces:
  - `INTERVALS = [0, 1, 3, 7, 14]`;
  - `practicePool(course, p): string[]`: os ids da prática das unidades com todos os blocos em `completedBlocks`, mais as unidades fracas;
  - `dueItems(pool, p, now): string[]`: os prontos, dos mais atrasados para os menos atrasados; os nunca vistos ficam por último, na ordem do curso;
  - `buildPracticeSession(course, p, minutes: Duration, now): SessionPlan`: um passo `{ kind: 'review', minutes, exerciseIds }` com ~1 exercício por minuto, tirados de `dueItems`. Quando faltam prontos, completa com os mais antigos não prontos. Com o pool vazio devolve `steps: []`;
  - `recordPractice(p, exerciseId, verdict: FinalVerdict, at: string): ProfileProgress`, que aplica as regras de Leitner das Global Constraints.
- [ ] **Step 1: Testes que falham:**
  - a sequência de caixas: acerto 1→2→…→5 e para no 5; quase mantém; erro volta para 1;
  - `dueItems` respeita os intervalos e a ordem;
  - pool vazio → `steps: []`;
  - tudo em dia → a sessão traz os mais antigos e não vem vazia;
  - progresso antigo → `practice: {}`;
  - um id repetido entre a prática e os blocos → `ContentError`.
- [ ] **Step 2:** Rodar os testes. Esperado: FAIL. Implementar. Rodar de novo. Esperado: PASS.
- [ ] **Step 3: Home**
  - O botão "Praticar mais" aparece quando `practicePool` não está vazio. Ele usa a duração escolhida e abre o `SessionScreen` com o plano pronto. As respostas passam pelo `recordPractice` e pelo `recordAttempt` (que já existe). O `SessionRecord` é gravado com os minutos, e isso conta na meta.
  - A sessão normal, quando não há erros abertos, usa até 2 itens de `dueItems` no passo de revisão.
- [ ] **Step 4:** Rodar `npm test`, `typecheck`, `lint` e `build`. Commit `feat: practice bank with spaced repetition and "Praticar mais"`.

---

### Task 4: Conteúdo — prática extra e diálogos (paralelo por nível)

Um subagente por nível (A1, A2, B1, B2, C1), cada um só com os arquivos do seu nível, como no Plano 5.

**Files:** `content/units/<nível>-*.json` (só acrescentar `practice` e diálogos; os blocos não mudam, a não ser trocar 1 exercício do bloco `conversation` por um `dialogue` em pelo menos 4 unidades por nível) e `content/audio/*` (gerado depois)

- [ ] **Step 1:** Em cada uma das 12 unidades do nível:
  - acrescentar `practice` com 24 a 32 exercícios, com pelo menos 60% falados e pelo menos 1 `dialogue`;
  - reaproveitar o vocabulário e a gramática da unidade, com frases novas (não repetir as dos blocos);
  - seguir as regras de respostas aceitas e erros comuns do Plano 5.
- [ ] **Step 2:** Rodar `npx prettier --write` nos arquivos e `npx vitest run tests/content/real-content.test.ts tests/main/load-course.test.ts`. Esperado: passa para o nível, sem contar o áudio.
- [ ] **Step 3** (o controlador, depois dos 5 níveis):
  1. apertar no teste de conteúdo real as regras de `practice` (24 a 32, ≥ 60% falados) e de diálogo (≥ 1 por unidade);
  2. rodar `npm run audio`, `npm test`, `typecheck`, `lint` e `build`;
  3. gerar o pacote Mac e rodar o `--self-check`;
  4. commitar um commit por nível (`content: <NÍVEL> practice bank and dialogues`) e um com os áudios.
  Registrar no relatório quantos exercícios e quantos minutos de áudio foram acrescentados.
