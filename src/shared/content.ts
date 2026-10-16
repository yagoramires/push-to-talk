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
export const SPOKEN_KINDS = ['repeat', 'translate', 'listen_answer', 'free_speak', 'vocab'] as const

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

export const SpokenExerciseSchema = z.object({
  id: str,
  kind: z.enum(['repeat', 'translate', 'listen_answer']),
  instruction_pt: str,
  prompt: str.optional(),
  listen: str.optional(),
  audio: str.optional(),
  accepted: z.array(str).min(1),
  commonErrors: z.array(CommonErrorSchema)
})
export type SpokenExercise = z.infer<typeof SpokenExerciseSchema>

export const VocabCardSchema = z.object({
  id: str,
  kind: z.literal('vocab'),
  word_en: str,
  meaning_pt: str,
  example_en: str,
  audio: str.optional()
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
    audio: str.optional(),
    options: z.array(str).min(2).max(5),
    answer: z.number().int().min(0),
    explanation_pt: str.optional()
  })
  .refine((e) => e.answer < e.options.length, {
    path: ['answer'],
    message: 'answer must be an index within options'
  })
export type ChoiceExercise = z.infer<typeof ChoiceExerciseSchema>

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

export const ExerciseSchema = z.discriminatedUnion('kind', [
  SpokenExerciseSchema,
  VocabCardSchema,
  FreeSpeakSchema,
  ChoiceExerciseSchema,
  FillExerciseSchema,
  OrderExerciseSchema,
  MatchExerciseSchema
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

export type Course = { units: Unit[] } // ordenado por nível e depois por order
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

export function findExercise(
  course: Course,
  exerciseId: string
): { unit: Unit; block: Block; exercise: Exercise } | undefined {
  for (const unit of course.units)
    for (const block of unit.blocks) {
      const exercise = block.exercises.find((e) => e.id === exerciseId)
      if (exercise) return { unit, block, exercise }
    }
  return undefined
}

export function availableLevels(course: Course): Level[] {
  return LEVELS.filter((l) => course.units.some((u) => u.level === l))
}
