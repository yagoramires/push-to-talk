import { z } from 'zod'

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type Level = (typeof LEVELS)[number]
export const BLOCK_KINDS = [
  'warmup',
  'vocabulary',
  'pronunciation',
  'listening',
  'conversation',
  'review'
] as const
export type BlockKind = (typeof BLOCK_KINDS)[number]
export const SPOKEN_KINDS = [
  'repeat',
  'translate',
  'listen_answer',
  'free_speak',
  'vocab',
  'dialogue'
] as const

const str = z.string().min(1)
const isRegex = (s: string): boolean => {
  try {
    new RegExp(s)
    return true
  } catch {
    return false
  }
}

export const CommonErrorSchema = z.object({
  id: str,
  match: str.refine(isRegex, 'invalid regex'),
  explanation_pt: str,
  correction_en: str
})
export type CommonError = z.infer<typeof CommonErrorSchema>

export const SpokenExerciseSchema = z
  .object({
    id: str,
    kind: z.enum(['repeat', 'translate', 'listen_answer']),
    instruction_pt: str,
    prompt: str.optional(),
    listen: str.optional(),
    accepted: z.array(str).min(1),
    commonErrors: z.array(CommonErrorSchema)
  })
  .refine((e) => e.kind !== 'repeat' || !!e.prompt, {
    path: ['prompt'],
    message: 'repeat requires prompt'
  })
  .refine((e) => e.kind !== 'listen_answer' || !!e.listen, {
    path: ['listen'],
    message: 'listen_answer requires listen'
  })
export type SpokenExercise = z.infer<typeof SpokenExerciseSchema>

export const VocabCardSchema = z.object({
  id: str,
  kind: z.literal('vocab'),
  word_en: str,
  meaning_pt: str,
  example_en: str
})
export type VocabCard = z.infer<typeof VocabCardSchema>

export const FreeSpeakSchema = z.object({
  id: str,
  kind: z.literal('free_speak'),
  instruction_pt: str,
  prompt_en: str,
  guidelines_pt: z.array(str).min(1)
})
export type FreeSpeak = z.infer<typeof FreeSpeakSchema>

export const ChoiceExerciseSchema = z
  .object({
    id: str,
    kind: z.literal('choice'),
    instruction_pt: str,
    prompt: str.optional(),
    listen: str.optional(),
    options: z.array(str).min(2).max(5),
    answer: z.number().int().min(0),
    explanation_pt: str.optional()
  })
  .refine((e) => e.answer < e.options.length, {
    path: ['answer'],
    message: 'answer must be an index within options'
  })
export type ChoiceExercise = z.infer<typeof ChoiceExerciseSchema>

// commonErrors[].match de um fill é testado contra a resposta digitada para a lacuna (normalizada), não contra a frase inteira.
export const FillExerciseSchema = z
  .object({
    id: str,
    kind: z.literal('fill'),
    instruction_pt: str,
    sentence: str,
    accepted: z.array(str).min(1),
    commonErrors: z.array(CommonErrorSchema)
  })
  .refine((e) => e.sentence.split('___').length === 2, {
    path: ['sentence'],
    message: 'sentence must contain "___" exactly once'
  })
export type FillExercise = z.infer<typeof FillExerciseSchema>

export const OrderExerciseSchema = z.object({
  id: str,
  kind: z.literal('order'),
  instruction_pt: str,
  accepted: z.array(str).min(1)
})
export type OrderExercise = z.infer<typeof OrderExerciseSchema>

export const MatchExerciseSchema = z.object({
  id: str,
  kind: z.literal('match'),
  instruction_pt: str,
  pairs: z
    .array(z.object({ en: str, pt: str }))
    .min(3)
    .max(6)
})
export type MatchExercise = z.infer<typeof MatchExerciseSchema>

export const TurnSchema = z.discriminatedUnion('speaker', [
  z.object({ speaker: z.literal('partner'), text: str }),
  z.object({
    speaker: z.literal('you'),
    cue_pt: str,
    accepted: z.array(str).min(1),
    commonErrors: z.array(CommonErrorSchema)
  })
])
export type Turn = z.infer<typeof TurnSchema>
export type YouTurn = Extract<Turn, { speaker: 'you' }>

export const DialogueSchema = z
  .object({
    id: str,
    kind: z.literal('dialogue'),
    instruction_pt: str,
    scene_pt: str,
    turns: z.array(TurnSchema).min(2).max(12)
  })
  .refine((d) => d.turns[0]?.speaker === 'partner', {
    path: ['turns', 0],
    message: 'the first turn is the partner'
  })
  .refine(
    (d) => {
      const you = d.turns.filter((t) => t.speaker === 'you').length
      return you >= 3 && you <= 6
    },
    { path: ['turns'], message: 'needs 3 to 6 "you" turns' }
  )
export type Dialogue = z.infer<typeof DialogueSchema>

export const ExerciseSchema = z.discriminatedUnion('kind', [
  SpokenExerciseSchema,
  VocabCardSchema,
  FreeSpeakSchema,
  ChoiceExerciseSchema,
  FillExerciseSchema,
  OrderExerciseSchema,
  MatchExerciseSchema,
  DialogueSchema
])
export type Exercise = z.infer<typeof ExerciseSchema>

export const TeacherNotesSchema = z.object({
  goal_pt: str,
  prompts: z.array(str),
  watchFor: z.array(str)
})
export type TeacherNotes = z.infer<typeof TeacherNotesSchema>

export const BlockSchema = z.object({
  id: str,
  kind: z.enum(BLOCK_KINDS),
  minutes: z.number().int().min(1).max(15),
  teacher: TeacherNotesSchema,
  exercises: z.array(ExerciseSchema).min(1)
})
export type Block = z.infer<typeof BlockSchema>

export const UnitSchema = z.object({
  id: str,
  level: z.enum(LEVELS),
  order: z.number().int(),
  title_pt: str,
  title_en: str,
  objective_pt: str,
  blocks: z.array(BlockSchema).min(1)
})
export type Unit = z.infer<typeof UnitSchema>

export const SKILLS = ['listening', 'speaking', 'vocabulary', 'structure'] as const
export type Skill = (typeof SKILLS)[number]

export const AssessmentItemSchema = z
  .object({ skill: z.enum(SKILLS), unitId: str.optional(), exercise: ExerciseSchema })
  .refine(
    (i) =>
      i.skill === 'speaking'
        ? (SPOKEN_KINDS as readonly string[]).includes(i.exercise.kind)
        : i.exercise.kind !== 'free_speak',
    {
      path: ['exercise', 'kind'],
      message: 'speaking needs a spoken exercise; free_speak only in speaking'
    }
  )
export type AssessmentItem = z.infer<typeof AssessmentItemSchema>

const countSkill = (items: AssessmentItem[], s: Skill): number =>
  items.filter((i) => i.skill === s).length
const PLACEMENT_MIX: Record<Skill, number> = {
  listening: 2,
  speaking: 2,
  vocabulary: 1,
  structure: 1
}

export const PlacementSchema = z.object({
  levels: z
    .array(
      z
        .object({ level: z.enum(LEVELS), items: z.array(AssessmentItemSchema) })
        .refine((l) => SKILLS.every((s) => countSkill(l.items, s) === PLACEMENT_MIX[s]), {
          path: ['items'],
          message: 'each level needs exactly 2 listening, 2 speaking, 1 vocabulary, 1 structure'
        })
    )
    .refine((ls) => ls.map((l) => l.level).join() === LEVELS.join(), {
      message: `levels must be ${LEVELS.join(', ')}, in order`
    })
})
export type Placement = z.infer<typeof PlacementSchema>

export const LevelExamSchema = z.object({
  level: z.enum(LEVELS),
  minutes: z.number().int().min(20).max(30),
  parts: z
    .array(
      z
        .object({ skill: z.enum(SKILLS), items: z.array(AssessmentItemSchema).min(4) })
        .refine((p) => p.items.every((i) => i.skill === p.skill), {
          path: ['items'],
          message: 'every item must have the part skill'
        })
    )
    .refine(
      (ps) => ps.length === SKILLS.length && SKILLS.every((s) => ps.some((p) => p.skill === s)),
      {
        message: `needs exactly one part per skill (${SKILLS.join(', ')})`
      }
    )
})
export type LevelExam = z.infer<typeof LevelExamSchema>

export type Course = {
  units: Unit[] // ordenado por nível e depois por order
  placement?: Placement
  exams?: Partial<Record<Level, LevelExam>>
  audio: Record<string, string> // texto falado → arquivo em content/audio
}
export type Position = { unitId: string; blockIndex: number }

/** Próxima posição na trilha; null = fim do curso. */
export function nextPosition(course: Course, pos: Position): Position | null {
  const i = course.units.findIndex((u) => u.id === pos.unitId)
  if (i < 0) return null
  if (pos.blockIndex + 1 < course.units[i].blocks.length)
    return { unitId: pos.unitId, blockIndex: pos.blockIndex + 1 }
  const next = course.units[i + 1]
  return next ? { unitId: next.id, blockIndex: 0 } : null
}

/** Itens das avaliações com o nível de cada um. */
function assessmentItems(course: Course): { level: Level; item: AssessmentItem }[] {
  return [
    ...(course.placement?.levels ?? []).flatMap((l) =>
      l.items.map((item) => ({ level: l.level, item }))
    ),
    ...Object.values(course.exams ?? {}).flatMap((x) =>
      x.parts.flatMap((p) => p.items.map((item) => ({ level: x.level, item })))
    )
  ]
}

/** Exercícios das avaliações não têm bloco; a unidade vem do unitId ou é a primeira do nível. */
export function findExercise(
  course: Course,
  exerciseId: string
): { unit: Unit; block?: Block; exercise: Exercise } | undefined {
  for (const unit of course.units)
    for (const block of unit.blocks) {
      const exercise = block.exercises.find((e) => e.id === exerciseId)
      if (exercise) return { unit, block, exercise }
    }
  const found = assessmentItems(course).find(({ item }) => item.exercise.id === exerciseId)
  const unit =
    found &&
    (found.item.unitId
      ? course.units.find((u) => u.id === found.item.unitId)
      : course.units.find((u) => u.level === found.level))
  return found && unit ? { unit, exercise: found.item.exercise } : undefined
}

export function availableLevels(course: Course): Level[] {
  return LEVELS.filter((l) => course.units.some((u) => u.level === l))
}
