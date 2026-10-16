import {
  BLOCK_KINDS,
  LEVELS,
  SKILLS,
  type AssessmentItem,
  type Block,
  type Course,
  type Skill,
  type Unit
} from '../../src/shared/content'

function makeUnit(id: string, order: number): Unit {
  const blocks: Block[] = BLOCK_KINDS.map((kind) => ({
    id: `${id}-${kind}`,
    kind,
    minutes: 4,
    teacher: { goal_pt: 'Objetivo', prompts: ['Pergunta?'], watchFor: ['Erro comum'] },
    exercises: [
      {
        id: `${id}-${kind}-ex`,
        kind: 'repeat',
        instruction_pt: 'Repita',
        prompt: 'Hello',
        accepted: ['hello'],
        commonErrors: []
      },
      ...(kind === 'conversation'
        ? [
            {
              id: `${id}-conv-free`,
              kind: 'free_speak' as const,
              instruction_pt: 'Fale',
              prompt_en: 'Tell me about you.',
              guidelines_pt: ['Use frases curtas']
            }
          ]
        : [])
    ]
  }))
  return {
    id,
    level: 'A1',
    order,
    title_pt: id,
    title_en: id,
    objective_pt: 'Objetivo',
    blocks
  }
}

function makeItem(id: string, skill: Skill, unitId?: string): AssessmentItem {
  return {
    skill,
    ...(unitId && { unitId }),
    exercise: {
      id,
      kind: 'repeat',
      instruction_pt: 'Repita',
      prompt: 'Hello',
      accepted: ['hello'],
      commonErrors: []
    }
  }
}

const PLACEMENT_SKILLS: Skill[] = [
  'listening',
  'listening',
  'speaking',
  'speaking',
  'vocabulary',
  'structure'
]

export function makeCourse(): Course {
  return {
    units: [makeUnit('u1', 1), makeUnit('u2', 2)],
    placement: {
      levels: LEVELS.map((level) => ({
        level,
        items: PLACEMENT_SKILLS.map((skill, i) => makeItem(`p-${level}-${i}`, skill))
      }))
    },
    exams: {
      A1: {
        level: 'A1',
        minutes: 25,
        // Itens de listening apontam para u1; os demais ficam sem unitId.
        parts: SKILLS.map((skill) => ({
          skill,
          items: [0, 1, 2, 3].map((i) =>
            makeItem(`x-a1-${skill}-${i}`, skill, skill === 'listening' ? 'u1' : undefined)
          )
        }))
      }
    }
  }
}
