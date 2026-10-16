import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppApi } from '../shared/api'

const api: AppApi = {
  loadCourse: () => ipcRenderer.invoke('loadCourse'),
  loadState: () => ipcRenderer.invoke('loadState'),
  createProfile: (name) => ipcRenderer.invoke('createProfile', name),
  saveProgress: (progress) => ipcRenderer.invoke('saveProgress', progress),
  ensureMic: () => ipcRenderer.invoke('ensureMic'),
  transcribe: (wav, expected) => ipcRenderer.invoke('transcribe', wav, expected),
  evaluateFreeSpeak: (input) => ipcRenderer.invoke('evaluateFreeSpeak', input)
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
