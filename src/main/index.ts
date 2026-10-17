import { app, shell, session, BrowserWindow } from 'electron'
import { join } from 'path'
import { totalmem } from 'node:os'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerAudioProtocol } from './audio-protocol'
import { registerIpc } from './ipc'
import { initLog } from './log'
import { resourcePaths, selfCheck } from './self-check'
import { checkForUpdates } from './update'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// The app used to be "Inglês": keep that data folder so profiles, progress and AI models survive the rename.
app.setPath('userData', join(app.getPath('appData'), 'Inglês'))
const logPath = initLog(join(app.getPath('userData'), 'logs'))
console.info(
  `start v${app.getVersion()} electron ${process.versions.electron} ${process.platform}-${process.arch}`,
  `ram ${Math.round(totalmem() / 1024 ** 3)} GB packaged=${app.isPackaged}`
)
app.on('render-process-gone', (_e, _wc, d) =>
  console.error('render-process-gone', d.reason, d.exitCode)
)
app.on('child-process-gone', (_e, d) =>
  console.error('child-process-gone', d.type, d.reason, d.exitCode)
)

const paths = resourcePaths({
  packaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
  appPath: app.getAppPath()
})
registerAudioProtocol(paths.content)

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Package smoke test: no window, no IPC, exit code says whether the bundle is whole.
  if (process.argv.includes('--self-check')) {
    const { ok, lines } = await selfCheck(paths)
    process.stdout.write(lines.join('\n') + '\n')
    app.exit(ok ? 0 : 1)
    return
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('br.ingles.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
    window.webContents.on('console-message', (e) => {
      if (e.level === 'warning' || e.level === 'error')
        console.warn(`renderer ${e.level}: ${e.message} (${e.sourceId}:${e.lineNumber})`)
    })
  })

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) =>
    callback(permission === 'media')
  )

  registerIpc(logPath)

  createWindow()
  checkForUpdates()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
