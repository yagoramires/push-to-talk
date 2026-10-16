# Plano 4 — Nivelamento e provas de nível (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O perfil novo pode fazer um nivelamento adaptativo, com itens de escuta e de fala, que define o nível inicial. Ao terminar as unidades de um nível, a trilha trava até a pessoa passar na prova final daquele nível. Este plano traz o nivelamento completo (A1 a C1) e a prova do A1 como exemplo.

**Architecture:** O conteúdo das avaliações fica em `content/assessments/*.json` e usa os mesmos tipos de exercício das aulas. A lógica é pura, em `src/shared/assessment.ts`: motor do nivelamento, nota da prova e regras de bloqueio. O progresso ganha o nível atual e o histórico de provas. O `buildSession` respeita o bloqueio de nível. As telas novas reaproveitam o `ExerciseView` do modo solo e do guiado.

**Tech Stack:** O mesmo do Plano 1 (React, zod 4, Vitest). Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-10-15-app-ingles-design.md` (seções "Prova de nível" e "Objetivos" 3).

## Global Constraints

- **Habilidades:** exatamente `listening`, `speaking`, `vocabulary`, `structure`.
- **Nivelamento:** 6 itens por nível (2 listening, 2 speaking, 1 vocabulary, 1 structure), nos níveis A1, A2, B1, B2 e C1.
- **Regra para passar** (vale para o nível do nivelamento e para a prova): **acertos ≥ 70% no total e ≥ 50% em cada habilidade** presente.
  - No nivelamento, um nível com 5 de 6 acertos e pelo menos 1 de 2 em listening e em speaking passa. Com 4 de 6 não passa.
- **Fluxo do nivelamento:** começa no A1 e sobe enquanto a pessoa passa. O nível inicial é o **primeiro nível não aprovado** (no máximo C1). Quem passa em tudo começa no C1.
- **Prova de nível:** 4 partes, uma por habilidade, com pelo menos 4 exercícios cada. `minutes` entre 20 e 30. É liberada quando a posição na trilha chega à primeira unidade de um nível acima do nível atual, ou quando as unidades do nível atual acabam.
- **Prova do C1:** aprovação marca o curso como concluído.
- **Reprovação:** os exercícios errados entram no `errorLog`, então aparecem na revisão das próximas sessões. As unidades fracas (as `unitId` dos itens errados) ficam em `progress.weakUnits`. Enquanto a prova estiver pendente, as sessões trazem revisão e depois os blocos das unidades fracas (ou da última unidade do nível). A prova pode ser refeita quando a pessoa quiser.
- **Modo guiado:** a prova funciona nos dois modos. No guiado não há microfone (quem ensina marca), igual às aulas.
- **Pular o nivelamento:** continua possível escolher o nível na mão. É a opção "Escolher nível manualmente", que já existe no Plano 1.
- **Textos:** interface em português.
- **Progresso salvo:** progresso antigo, sem os campos novos, continua carregando, via `migrateProgress`.

## Review Focus

1. **Progresso salvo antes deste plano:** carrega sem erro. O nível vem da unidade da posição e a lista de provas fica vazia. Teste no Task 2.
2. **Trilha no fim de um nível com prova pendente:** a sessão não avança para o nível seguinte, mesmo com tempo sobrando. Teste no Task 2.
3. **Microfone indisponível no nivelamento:** os itens falados oferecem a marcação manual, como nas aulas, e o nivelamento continua. Verificação manual no Task 5.
4. **Fechar o app no meio da prova ou do nivelamento:** nada é gravado como aprovado. O resultado só é salvo no fim, e os erros de exercícios já respondidos podem ser salvos. Verificação manual no Task 5.
5. **Pessoa que acerta tudo no nivelamento:** começa no C1, sem estourar. Teste no Task 3.

---

### Task 1: Formato das avaliações e leitura

**Files:**
- Modify: `src/shared/content.ts`, `src/main/content/load-course.ts`, `tests/fixtures/course.ts`
- Test: `tests/shared/content.test.ts`, `tests/main/load-course.test.ts`

**Interfaces:**

```ts
// content.ts
export const SKILLS = ['listening', 'speaking', 'vocabulary', 'structure'] as const
export type Skill = (typeof SKILLS)[number]
export type AssessmentItem = { skill: Skill; unitId?: string; exercise: Exercise }
export type Placement = { levels: { level: Level; items: AssessmentItem[] }[] }   // 5 níveis, na ordem de LEVELS
export type LevelExam = { level: Level; minutes: number; parts: { skill: Skill; items: AssessmentItem[] }[] }
export type Course = { units: Unit[]; placement?: Placement; exams?: Partial<Record<Level, LevelExam>> }
export const PlacementSchema: z.ZodType<Placement>
export const LevelExamSchema: z.ZodType<LevelExam>
```

- **Validação do nivelamento:** os 5 níveis, cada um com exatamente 2/2/1/1 itens por habilidade.
- **Validação da prova:** as 4 habilidades, cada uma uma vez, cada parte com pelo menos 4 itens, `minutes` inteiro de 20 a 30.
- **Habilidade speaking:** o item precisa ser falado (`SPOKEN_KINDS`), e os itens das outras habilidades não podem ser `free_speak`.
- **Loader:** lê `assessments/placement.json` e `assessments/exam-<nível minúsculo>.json` quando existirem.
- **Ids:** os ids de exercício das avaliações entram na checagem global de ids únicos.
- **`unitId`:** quando presente, precisa existir no curso.
- **Erros:** `ContentError` com o nome do arquivo, como já acontece nas unidades.
- **`findExercise`:** passa a achar também os exercícios das avaliações. Para eles, `unit` vem do `unitId`, ou da primeira unidade do nível do item quando não houver `unitId`, para que a revisão funcione.
- **Fixture:** a `makeCourse()` ganha `exams.A1` mínima, válida, com 4 itens por parte, e um `placement` mínimo válido. Os ids seguem `p-${level}-${i}` e `x-a1-${skill}-${i}`.

- [ ] **Step 1: Testes que falham:**
  - os schemas aceitam a fixture;
  - rejeitam um nível do nivelamento com 3 itens de listening;
  - rejeitam uma prova sem a parte `structure`;
  - rejeitam um `free_speak` na parte `vocabulary`;
  - o loader lê as avaliações de um diretório temporário;
  - o loader rejeita um `unitId` inexistente, com o nome do arquivo na mensagem;
  - o loader rejeita um id de exercício duplicado entre a unidade e a prova;
  - `findExercise` acha um item da prova.
- [ ] **Step 2:** Implementar. Rodar `npm test`, `typecheck` e `lint`.
- [ ] **Step 3:** Commit `feat: assessment content format (placement and level exams)`.

---

### Task 2: Nível no progresso, bloqueio da trilha e nota da prova

**Files:**
- Create: `src/shared/assessment.ts`
- Modify: `src/shared/progress.ts`, `src/shared/session.ts`, `src/renderer/src/App.tsx` (chamar `migrateProgress` ao carregar)
- Test: `tests/shared/assessment.test.ts`, `tests/shared/session.test.ts`, `tests/shared/progress.test.ts`

**Interfaces:**

```ts
// progress.ts — ProfileProgress ganha:
//   level: Level; exams: ExamRecord[]; weakUnits: string[]; courseComplete: boolean
export type ExamRecord = { level: Level; at: string; mode: Mode; scores: Record<Skill, number> /* 0..1 */; total: number; passed: boolean }
export function migrateProgress(p: ProfileProgress, course: Course): ProfileProgress   // preenche campos que faltam; level = nível da unidade da posição (ou startLevel)
// newProgress passa a preencher level = startLevel, exams [], weakUnits [], courseComplete false
// assessment.ts
export const PASS_TOTAL = 0.7
export const PASS_EACH = 0.5
export function passes(results: { skill: Skill; correct: boolean }[]): { passed: boolean; scores: Partial<Record<Skill, number>>; total: number }
export function examDue(p: ProfileProgress, course: Course): Level | null   // nível atual quando a posição saiu do nível atual (unidade de nível acima ou null) e não há prova aprovada desse nível; senão null
export function applyExamResult(p: ProfileProgress, course: Course, exam: LevelExam,
  answers: { exerciseId: string; skill: Skill; unitId?: string; correct: boolean; transcript: string }[], at: string, mode: Mode): { progress: ProfileProgress; record: ExamRecord }
```

- **`applyExamResult`:** grava o `ExamRecord`. Cada resposta errada passa por `recordAttempt` como erro, e cada certa como acerto.
  - Se passou: `level` vira o próximo nível (ou continua C1 com `courseComplete: true`) e `weakUnits` vira `[]`.
  - Se não passou: `weakUnits` recebe as `unitId` distintas dos itens errados. Para itens sem `unitId`, usa a última unidade do nível.
- **`buildSession`:** ao percorrer blocos, para antes de entrar numa unidade cujo nível está acima de `p.level`.
  - Se `examDue(p)` não for null, os passos são a revisão, depois os blocos das unidades em `p.weakUnits` (ou da última unidade de `p.level`), na ordem e cabendo no orçamento, e por fim a conversa final dessa unidade, se houver.
  - `SessionPlan` ganha `examDue: Level | null`.
  - O `completeBlock` desses blocos de reforço não mexe na posição, que já é o comportamento atual quando o bloco não é o da posição.

- [ ] **Step 1: Testes que falham:**
  - `passes`: 5/6 com listening 1/2 e speaking 1/2 → passa; 4/6 → não passa; 6/6 com speaking 0/2 → impossível, então usar 5/6 com speaking 0/2, que não passa por `PASS_EACH`;
  - `migrateProgress` de um objeto sem `level`/`exams` → level = nível da unidade e os campos são preenchidos;
  - `examDue`:
    - curso de fixture com u1 e u2 no A1, mais u3 no A2 (estender a fixture com `makeCourse({ withA2: true })`);
    - posição em u3 com level A1 → 'A1';
    - posição em u1 → null;
    - level A1 com prova A1 aprovada → null;
  - `buildSession` com posição em u2 (bloco 4), level A1 e 60 min → não inclui bloco de u3 e `examDue` fica null até a posição chegar em u3;
  - com posição em u3 e level A1 → `examDue` 'A1', os blocos são de u2 (última unidade do A1) e não há bloco de u3;
  - com `weakUnits ['u1']` → os blocos são de u1;
  - `applyExamResult` aprovado → level A2, record passed, weakUnits [];
  - reprovado → os erros entram no `errorLog`, `weakUnits` = unidades dos itens errados e level continua A1;
  - aprovado no C1 → `courseComplete` true.
- [ ] **Step 2:** Implementar e chamar `migrateProgress` em todo progresso carregado no `App.tsx`. Rodar `npm test`, `typecheck` e `lint`.
- [ ] **Step 3:** Commit `feat: level gating, exam scoring and progress migration`.

---

### Task 3: Motor do nivelamento

**Files:**
- Modify: `src/shared/assessment.ts`
- Test: `tests/shared/assessment.test.ts`

**Interfaces:**

```ts
export type PlacementState = { levelIndex: number; answers: { level: Level; skill: Skill; correct: boolean }[]; done: boolean; result: Level | null }
export function startPlacement(): PlacementState                                  // levelIndex 0 (A1)
export function currentPlacementItems(placement: Placement, s: PlacementState): AssessmentItem[]   // os 6 itens do nível atual
export function finishPlacementLevel(s: PlacementState, answers: { skill: Skill; correct: boolean }[]): PlacementState
// passou (regra `passes`) e não é o último nível → levelIndex+1; não passou → done, result = esse nível; passou no último (C1) → done, result = 'C1'
```

- [ ] **Step 1: Testes que falham:**
  - erra o A1 → result A1;
  - passa A1 e A2 e erra o B1 → result B1;
  - passa tudo → result C1 e `done`;
  - `currentPlacementItems` devolve os itens do nível do estado.
- [ ] **Step 2:** Implementar, rodar e fazer o commit `feat: adaptive placement engine`.

---

### Task 4: Conteúdo — nivelamento A1–C1 e prova do A1

**Files:**
- Create: `content/assessments/placement.json`, `content/assessments/exam-a1.json`
- Modify: `tests/content.test.ts`

**Requisitos de conteúdo:**
- **Público:** brasileiros. Explicações e instruções em pt-BR; o conteúdo em inglês precisa ser natural e correto.
- **Nivelamento:** 30 itens, com dificuldade claramente crescente por nível de acordo com o CEFR. Exemplos: A1 = cumprimentos, verbo to be, números; B1 = passado e experiências; C1 = expressões idiomáticas, inversões e registro.
  - **Listening:** `choice` com `listen` (ouça e escolha) ou `listen_answer`.
  - **Speaking:** `translate` ou `repeat` com várias respostas aceitas.
  - **Vocabulary:** `choice` ou `match`.
  - **Structure:** `fill` ou `order`.
- **Prova do A1:** 4 partes com 5 itens cada, cobrindo o programa típico do A1 (apresentações, to be, números e idade, família, rotina, horas, comida, lugares, há/existe, presente simples, can, likes/dislikes), com questões **diferentes** das unidades. Itens ligados às unidades existentes usam `unitId` (`a1-01-greetings`, `a1-02-numbers-age`); os outros ficam sem `unitId`. `minutes: 25`.
- **Regras gerais:** todo exercício falado ou de completar segue as regras das unidades (respostas aceitas amplas, `commonErrors` com explicação em português e regex em forma normalizada). Os ids são únicos e prefixados: `pl-`, `ex-a1-`.
- **Testes em `tests/content.test.ts`:**
  - o curso real carrega com `placement` e `exams.A1`;
  - toda resposta aceita de toda avaliação dá `checkAnswer` correto;
  - cada nível do nivelamento tem pelo menos 2 tipos de exercício.

- [ ] **Step 1:** Escrever o conteúdo e os testes. Rodar `npm test`.
- [ ] **Step 2:** Commit `feat: placement test (A1-C1) and A1 level exam content`.

---

### Task 5: Telas — nivelamento, aviso de prova e prova

**Files:**
- Create: `src/renderer/src/screens/PlacementScreen.tsx`, `src/renderer/src/screens/ExamScreen.tsx`, `src/renderer/src/components/ExamResult.tsx`
- Modify: `src/renderer/src/screens/ProfilesScreen.tsx`, `src/renderer/src/screens/HomeScreen.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/screens/SessionScreen.tsx` (mensagem quando `plan.examDue`), CSS

**Comportamento:**
- **Perfil novo:** depois do nome, escolher entre "Fazer o nivelamento (10 a 15 min)" e "Escolher nível manualmente", que é o fluxo atual.
- **`PlacementScreen`:**
  - roda nível por nível com o `ExerciseView` em modo solo (`key` por item);
  - mostra um título por nível sem revelar o nível ("Parte 2 de até 5");
  - ao terminar, mostra "Seu nível inicial: A2", um resumo por habilidade e o botão "Começar";
  - cria o progresso com `newProgress(id, result, course)` e salva;
  - os erros do nivelamento não entram no `errorLog`;
  - fechar no meio não salva nada, e o perfil fica sem progresso, que é o fluxo de seleção que já existe no Plano 1.
- **Início com `examDue(progress, course)`:** aparece um destaque "Você terminou as unidades do A1! Faça a prova final para passar ao A2", com "Fazer a prova (solo)" e "Fazer a prova (guiado)". As sessões normais continuam disponíveis (são o reforço).
- **`ExamScreen`:**
  - percorre as partes na ordem, com o título da parte em português (Listening, Fala, Vocabulário, Estrutura de frases);
  - tem um contador de `exam.minutes` que nunca encerra sozinho;
  - nos itens, usa `ExerciseView` com o modo escolhido; no guiado não há microfone e quem ensina marca;
  - durante a prova o `ResultView` só mostra o veredito e "Continuar", sem explicação, porque a correção detalhada fica para o fim;
  - no fim chama `applyExamResult`, salva e mostra o `ExamResult`.
- **`ExamResult`:** aprovado ou não, a nota por parte em %, a regra ("70% no total e 50% em cada parte") e, se reprovado, as unidades fracas pelo título. Tem o botão "Voltar ao início". Se for o C1 aprovado, mostra "Parabéns, você concluiu o curso!".
- **`SessionScreen`:** quando `plan.examDue`, mostra no topo o aviso "Sessão de reforço — a prova do A1 está liberada no início".
- **Teste:** a lógica pura nova da UI leva teste em `tests/renderer/`.

- [ ] **Step 1:** Implementar. Rodar `npm test`, `typecheck`, `lint` e `build`, e `npm run dev` por cerca de 20 s sem erros. As verificações manuais ficam pendentes para uma pessoa:
  - nivelamento completo errando no B1 → nível B1, mas o conteúdo só tem A1, então o app precisa lidar com isso (ver abaixo);
  - prova do A1 aprovada e reprovada;
  - fechar no meio.
  
  **Nível sem unidades:** se o nível do resultado não tiver unidades no curso atual, `newProgress` lançaria erro. Nesse caso, mostrar "Seu nível é B1. As unidades desse nível ainda não estão no app; por enquanto você começa no nível mais alto disponível (A1)" e usar o maior nível disponível que seja menor ou igual ao resultado.
- [ ] **Step 2:** Commit `feat: placement, level exam screens and exam-due gating in the UI`.
