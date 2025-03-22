import { ElectronAPI } from '@electron-toolkit/preload'

// Token response interface
interface TokenInfo {
  apiUrl: string
  tenant: string
  accessToken: string
  refreshToken: string
  expiresIn: number
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      login: (schoolUuid: string, oidcUrl: string) => Promise<{ success: boolean; error?: string }>
      copyToClipboard: (text: string) => Promise<boolean>
      onLoginSuccess: (callback: (data: TokenInfo) => void) => () => void
      onLoginError: (callback: (error: string) => void) => () => void
    }
  }
}
