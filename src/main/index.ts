import { app, shell, BrowserWindow, ipcMain, session, clipboard } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import axios from 'axios'

// Somtoday API constants
const CLIENT_ID = 'somtoday-leerling-native'
const REDIRECT_URI = 'somtoday://nl.topicus.somtoday.leerling/oauth/callback'
const CODE_VERIFIER = 't9b9-QCBB3hwdYa3UW2U2c9hhrhNzDdPww8Xp6wETWQ'
const CODE_CHALLENGE = 'tCqjy6FPb1kdOfvSa43D8a7j8FLDmKFCAz8EdRGdtQA'

// Interface for token response
interface TokenResponse {
  access_token: string
  refresh_token: string
  somtoday_api_url: string
  scope: string
  somtoday_tenant: string
  id_token: string
  token_type: string
  expires_in: number
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
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

  // Setup IPC handlers
  setupIpcHandlers(mainWindow)
}

function setupIpcHandlers(mainWindow: BrowserWindow): void {
  // Handle the token generation request from renderer
  ipcMain.handle('login', async (_, schoolUuid: string, oidcUrl: string) => {
    console.log('Received login request for school:', schoolUuid, 'with OIDC URL:', oidcUrl)
    try {
      const authWindow = new BrowserWindow({
        width: 800,
        height: 800,
        show: true,
        parent: mainWindow,
        modal: true,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      // Build OAuth URL with the school's information
      const baseUrl = 'https://somtoday.nl/oauth2/authorize'
      const params = new URLSearchParams({
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        response_type: 'code',
        prompt: 'login',
        scope: 'openid',
        code_challenge: CODE_CHALLENGE,
        code_challenge_method: 'S256',
        tenant_uuid: schoolUuid,
        oidc_iss: oidcUrl
      })

      const authUrl = `${baseUrl}?${params.toString()}`
      console.log('Opening auth URL:', authUrl)

      // Extract the protocol from the redirect URI
      const protocol = new URL(REDIRECT_URI).protocol.replace(':', '')
      console.log('Protocol to register:', protocol)

      // Setup navigation event handlers to catch the OAuth redirect
      const handleNavigation = (navUrl: string): boolean => {
        // console.log('Navigation detected to:', navUrl)
        if (navUrl.startsWith(REDIRECT_URI) || navUrl.includes('/oauth/callback')) {
          handleAuthCallback(navUrl, authWindow, mainWindow)
          return true
        }
        return false
      }

      authWindow.webContents.on('will-redirect', (event, url) => {
        console.log('Will redirect to:', url)
        if (handleNavigation(url)) {
          event.preventDefault()
        }
      })

      authWindow.webContents.on('did-navigate', (_, url) => {
        handleNavigation(url)
      })

      authWindow.webContents.on('did-redirect-navigation', (_, url) => {
        handleNavigation(url)
      })

      // Handle the auth window closing without successful login
      let authSuccessful = false

      // We'll set this flag when auth is successful
      const handleAuthSuccess = (): void => {
        authSuccessful = true
      }

      // Add event listener to track successful auth using IPC
      ipcMain.once('login-success-event', handleAuthSuccess)

      // When auth window is closed
      authWindow.on('closed', () => {
        console.log('Auth window closed, authSuccessful:', authSuccessful)

        // Remove the success listener since we don't need it anymore
        ipcMain.removeListener('login-success-event', handleAuthSuccess)

        // If auth wasn't successful and the window was closed, notify renderer
        if (!authSuccessful) {
          mainWindow.webContents.send(
            'login-error',
            'Inlogvenster gesloten zonder voltooide authenticatie'
          )
        }
      })

      // Load the auth URL
      await authWindow.loadURL(authUrl)

      return { success: true }
    } catch (error) {
      console.error('Error during token generation process:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Add an IPC handler to copy text to clipboard
  ipcMain.handle('copy-to-clipboard', (_, text: string) => {
    try {
      clipboard.writeText(text)
      return true
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      return false
    }
  })
}

async function handleAuthCallback(
  callbackUrl: string,
  authWindow: BrowserWindow,
  mainWindow: BrowserWindow
): Promise<void> {
  try {
    console.log('Processing callback URL:', callbackUrl)

    // Parse the callback URL to extract the authorization code
    let code: string | null = null

    if (callbackUrl.startsWith('somtoday://')) {
      // For custom protocol
      const urlParts = callbackUrl.split('?')
      if (urlParts.length > 1) {
        const params = new URLSearchParams(urlParts[1])
        code = params.get('code')
      }
    } else {
      // For regular URLs
      const url = new URL(callbackUrl)
      code = url.searchParams.get('code')
    }

    if (code) {
      console.log('Authorization code received, exchanging for token...')

      // Exchange the authorization code for an access token
      const tokenResponse = await exchangeCodeForToken(code)

      // Close the auth window after successful authentication
      authWindow.close()

      // Notify the renderer that we got a token directly
      mainWindow.webContents.send('login-success', {
        apiUrl: tokenResponse.somtoday_api_url,
        tenant: tokenResponse.somtoday_tenant,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresIn: tokenResponse.expires_in
      })

      // Also emit on IPC to track successful auth
      ipcMain.emit('login-success-event')

      console.log('Tokens successfully generated')
    } else {
      console.error('No authorization code found in callback URL')
      authWindow.close()
      mainWindow.webContents.send('login-error', 'Kon geen autorisatiecode verkrijgen')
    }
  } catch (error) {
    console.error('Error handling auth callback:', error)
    authWindow.close()
    mainWindow.webContents.send(
      'login-error',
      `Token genereren mislukt: ${(error as Error).message}`
    )
  }
}

async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  try {
    // Prepare the token request
    const tokenUrl = 'https://somtoday.nl/oauth2/token'

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code_verifier: CODE_VERIFIER,
      code: code,
      scope: 'openid',
      client_id: CLIENT_ID
    })

    // Make the token request
    const response = await axios.post(tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    // Return the token data
    return response.data
  } catch (error) {
    console.error('Error exchanging code for token:', error)
    throw new Error(
      `Token aanvraag mislukt: ${(error as any).response?.data?.error_description || (error as Error).message}`
    )
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register the custom protocol - using the correct protocol from Somtoday
  if (is.dev) {
    // In development, we need to register the protocol differently
    session.defaultSession.protocol.registerStringProtocol('somtoday', (req, callback) => {
      console.log('Protocol request received in dev mode:', req.url)
      callback('Protocol registered')
    })
  } else {
    console.log('Setting somtoday as default protocol client')
    app.setAsDefaultProtocolClient('somtoday')
  }

  createWindow()

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
