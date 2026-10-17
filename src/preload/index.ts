import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AiProgress, AppApi, UpdateInfo } from '../shared/api'

const api: AppApi = {
  platform: 'desktop',
  audioUrl: (file) => `course-audio://audio/${file}`,
  loadCourse: () => ipcRenderer.invoke('loadCourse'),
  loadState: () => ipcRenderer.invoke('loadState'),
  createProfile: (name) => ipcRenderer.invoke('createProfile', name),
  saveProgress: (progress) => ipcRenderer.invoke('saveProgress', progress),
  ensureMic: () => ipcRenderer.invoke('ensureMic'),
  transcribe: (wav, expected, hint) => ipcRenderer.invoke('transcribe', wav, expected, hint),
  evaluateFreeSpeak: (input) => ipcRenderer.invoke('evaluateFreeSpeak', input),
  aiStatus: () => ipcRenderer.invoke('aiStatus'),
  setupAi: (tier) => ipcRenderer.invoke('setupAi', tier),
  openLogs: () => ipcRenderer.invoke('openLogs'),
  getSettings: () => ipcRenderer.invoke('getSettings'),
  setSaveSamples: (on) => ipcRenderer.invoke('setSaveSamples', on),
  saveSample: (sample) => ipcRenderer.invoke('saveSample', sample),
  openSamples: () => ipcRenderer.invoke('openSamples'),
  deleteSamples: () => ipcRenderer.invoke('deleteSamples'),
  getUpdate: () => ipcRenderer.invoke('getUpdate'),
  installUpdate: () => ipcRenderer.invoke('installUpdate'),
  onUpdate(cb) {
    const listener = (_e: IpcRendererEvent, u: UpdateInfo): void => cb(u)
    ipcRenderer.on('update', listener)
    return () => void ipcRenderer.off('update', listener)
  },
  onAiProgress(cb) {
    const listener = (_e: IpcRendererEvent, p: AiProgress): void => cb(p)
    ipcRenderer.on('ai-progress', listener)
    return () => void ipcRenderer.off('ai-progress', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
