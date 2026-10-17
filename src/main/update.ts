import { app, BrowserWindow, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateInfo } from '../shared/api'
import { checkRelease } from '../shared/update'

let info: UpdateInfo | null = null
let downloadUrl = ''

function found(u: UpdateInfo): void {
  info = u
  console.info('update found', u.version, u.action)
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('update', u))
}

/** Once per launch, in the background; any failure is only logged. */
export function checkForUpdates(): void {
  if (process.platform === 'win32' && app.isPackaged) {
    // Downloads in the background; autoInstallOnAppQuit (default) installs on the next quit too.
    autoUpdater.on('update-downloaded', (u) => found({ version: u.version, action: 'restart' }))
    autoUpdater.on('error', (e) => console.warn('update check failed', e.message))
    autoUpdater.checkForUpdates().catch(() => {}) // already logged by the error event
  } else if (process.platform === 'darwin') {
    // Squirrel.Mac needs a real signature: only point at the new dmg.
    checkRelease(fetch, app.getVersion(), '-mac-arm64.dmg').then(
      (r) => {
        if (!r) return
        downloadUrl = r.url
        found({ version: r.version, action: 'download' })
      },
      (e) => console.warn('update check failed', String(e))
    )
  }
}

export const getUpdate = async (): Promise<UpdateInfo | null> => info

export async function installUpdate(): Promise<void> {
  if (info?.action === 'restart') autoUpdater.quitAndInstall()
  else if (downloadUrl) await shell.openExternal(downloadUrl)
}
