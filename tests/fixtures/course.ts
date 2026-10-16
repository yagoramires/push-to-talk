import { BLOCK_KINDS, type Block, type Course, type Unit } from '../../src/shared/content'

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

export function makeCourse(): Course {
  return { units: [makeUnit('u1', 1), makeUnit('u2', 2)] }
}
