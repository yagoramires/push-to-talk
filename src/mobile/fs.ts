import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'

export type TextFs = {
  read(path: string): Promise<string | undefined> // undefined = não existe
  write(path: string, data: string): Promise<void> // cria as pastas
  append(path: string, data: string): Promise<void>
  writeBytes(path: string, data: Uint8Array): Promise<void>
  rename(from: string, to: string): Promise<void>
  remove(path: string): Promise<void> // arquivo ou pasta; ausente não é erro
  size(path: string): Promise<number | undefined>
  uri(path: string): Promise<string> // file:// para código nativo e Share
}

const directory = Directory.Data

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function createCapacitorFs(): TextFs {
  const mkdirOf = async (path: string): Promise<void> => {
    const dir = path.split('/').slice(0, -1).join('/')
    if (dir) await Filesystem.mkdir({ path: dir, directory, recursive: true }).catch(() => {})
  }
  return {
    async read(path) {
      try {
        const r = await Filesystem.readFile({ path, directory, encoding: Encoding.UTF8 })
        return r.data as string
      } catch {
        return undefined
      }
    },
    async write(path, data) {
      await Filesystem.writeFile({
        path,
        directory,
        data,
        encoding: Encoding.UTF8,
        recursive: true
      })
    },
    async append(path, data) {
      const opts = { path, directory, data, encoding: Encoding.UTF8 }
      // mkdir first only when needed: the plugin console.errors every failure, and the log copies console.
      try {
        await Filesystem.appendFile(opts)
      } catch {
        await mkdirOf(path)
        await Filesystem.appendFile(opts)
      }
    },
    async writeBytes(path, data) {
      await Filesystem.writeFile({ path, directory, data: toBase64(data), recursive: true })
    },
    async rename(from, to) {
      await mkdirOf(to)
      await Filesystem.rename({ from, to, directory, toDirectory: directory })
    },
    async remove(path) {
      try {
        const { type } = await Filesystem.stat({ path, directory })
        if (type === 'directory') await Filesystem.rmdir({ path, directory, recursive: true })
        else await Filesystem.deleteFile({ path, directory })
      } catch {
        // absent is fine
      }
    },
    async size(path) {
      try {
        return (await Filesystem.stat({ path, directory })).size
      } catch {
        return undefined
      }
    },
    async uri(path) {
      return (await Filesystem.getUri({ path, directory })).uri
    }
  }
}
