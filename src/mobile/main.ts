import { App } from '@capacitor/app'
import { createMobileApi } from './api'
import { createCapacitorFs } from './fs'
import { initMobileLog } from './log'

initMobileLog(createCapacitorFs())

window.api = createMobileApi()

// Android's back button would close the app and lose the open lesson.
void App.addListener('backButton', () => {
  if (window.confirm('Sair do app? O que não foi salvo se perde.')) void App.exitApp()
})

await import('../renderer/src/main')
