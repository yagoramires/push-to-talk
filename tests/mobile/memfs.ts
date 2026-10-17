import type { TextFs } from '../../src/mobile/fs'

export type MemFs = TextFs & { files: Map<string, string | Uint8Array> }

export function memFs(): MemFs {
  const files = new Map<string, string | Uint8Array>()
  const text = (p: string): string | undefined => {
    const v = files.get(p)
    return typeof v === 'string' ? v : undefined
  }
  return {
    files,
    read: async (p) => text(p),
    write: async (p, d) => void files.set(p, d),
    append: async (p, d) => void files.set(p, (text(p) ?? '') + d),
    writeBytes: async (p, d) => void files.set(p, d),
    rename: async (a, b) => {
      files.set(b, files.get(a)!)
      files.delete(a)
    },
    remove: async (p) => {
      for (const k of [...files.keys()]) if (k === p || k.startsWith(p + '/')) files.delete(k)
    },
    size: async (p) => (files.has(p) ? String(files.get(p)).length : undefined),
    uri: async (p) => 'file:///mem/' + p
  }
}
