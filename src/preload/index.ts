import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Token interface
interface TokenInfo {
  apiUrl: string
  tenant: string
  accessToken: string
  refreshToken: string
  expiresIn: number
}

// Custom APIs for renderer
const api = {
  login: (schoolUuid: string, oidcUrl: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('login', schoolUuid, oidcUrl)
  },

  copyToClipboard: (text: string): Promise<boolean> => {
    return ipcRenderer.invoke('copy-to-clipboard', text)
  },

  onLoginSuccess: (callback: (data: TokenInfo) => void) => {
    ipcRenderer.on('login-success', (_, data: TokenInfo) => callback(data))
    return (): void => {
      ipcRenderer.removeAllListeners('login-success')
    }
  },

  onLoginError: (callback: (error: string) => void) => {
    ipcRenderer.on('login-error', (_, error: string) => callback(error))
    return (): void => {
      ipcRenderer.removeAllListeners('login-error')
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
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
