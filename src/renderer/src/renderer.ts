import { School, SchoolsResponse } from './types/school'

// Token interface
interface TokenInfo {
  apiUrl: string
  tenant: string
  accessToken: string
  refreshToken: string
  expiresIn: number
}

const SCHOOLS_API_URL =
  'https://raw.githubusercontent.com/NONtoday/organisaties.json/refs/heads/main/organisaties.json'

// Elements - School Selection
let schoolSearchInput: HTMLInputElement
let schoolsList: HTMLUListElement
let loadingContainer: HTMLElement
let schoolsContainer: HTMLElement
let errorContainer: HTMLElement
let retryButton: HTMLButtonElement
let noResultsElement: HTMLElement
let schoolSelectionContainer: HTMLElement

// Elements - Auth Loading Screen
let authLoadingContainer: HTMLElement

// Elements - Token Display
let tokenContainer: HTMLElement
let schoolNameDisplay: HTMLElement
let accessTokenTab: HTMLButtonElement
let refreshTokenTab: HTMLButtonElement
let accessTokenPanel: HTMLElement
let refreshTokenPanel: HTMLElement
let accessTokenText: HTMLTextAreaElement
let refreshTokenText: HTMLTextAreaElement
let copyAccessTokenBtn: HTMLButtonElement
let copyRefreshTokenBtn: HTMLButtonElement
let newTokenBtn: HTMLButtonElement
let accessTokenQR: HTMLCanvasElement
let refreshTokenQR: HTMLCanvasElement

// State
let allSchools: School[] = []

async function init(): Promise<void> {
  window.addEventListener('DOMContentLoaded', () => {
    setupElements()
    setupEventListeners()
    fetchSchools()
    setupLoginHandlers()
  })
}

function setupElements(): void {
  // School Selection Elements
  schoolSearchInput = document.getElementById('school-search') as HTMLInputElement
  schoolsList = document.getElementById('schools-list') as HTMLUListElement
  loadingContainer = document.getElementById('loading-container') as HTMLElement
  schoolsContainer = document.getElementById('schools-container') as HTMLElement
  errorContainer = document.getElementById('error-container') as HTMLElement
  retryButton = document.getElementById('retry-button') as HTMLButtonElement
  noResultsElement = document.getElementById('no-results') as HTMLElement
  schoolSelectionContainer = document.getElementById('school-selection-container') as HTMLElement

  // Auth Loading Screen
  authLoadingContainer = document.getElementById('auth-loading-container') as HTMLElement

  // Token Display Elements
  tokenContainer = document.getElementById('token-container') as HTMLElement
  schoolNameDisplay = document.getElementById('school-name') as HTMLElement
  accessTokenTab = document.getElementById('access-token-tab') as HTMLButtonElement
  refreshTokenTab = document.getElementById('refresh-token-tab') as HTMLButtonElement
  accessTokenPanel = document.getElementById('access-token-panel') as HTMLElement
  refreshTokenPanel = document.getElementById('refresh-token-panel') as HTMLElement
  accessTokenText = document.getElementById('access-token-text') as HTMLTextAreaElement
  refreshTokenText = document.getElementById('refresh-token-text') as HTMLTextAreaElement
  copyAccessTokenBtn = document.getElementById('copy-access-token') as HTMLButtonElement
  copyRefreshTokenBtn = document.getElementById('copy-refresh-token') as HTMLButtonElement
  newTokenBtn = document.getElementById('new-token-button') as HTMLButtonElement
  accessTokenQR = document.getElementById('access-token-qr') as HTMLCanvasElement
  refreshTokenQR = document.getElementById('refresh-token-qr') as HTMLCanvasElement
}

function setupEventListeners(): void {
  // School selection event listeners
  schoolSearchInput.addEventListener('input', handleSearchInput)
  retryButton.addEventListener('click', fetchSchools)

  // Token display event listeners
  accessTokenTab.addEventListener('click', () => switchTab('access'))
  refreshTokenTab.addEventListener('click', () => switchTab('refresh'))
  copyAccessTokenBtn.addEventListener('click', () =>
    copyToClipboard(accessTokenText.value, 'Access token')
  )
  copyRefreshTokenBtn.addEventListener('click', () =>
    copyToClipboard(refreshTokenText.value, 'Refresh token')
  )
  newTokenBtn.addEventListener('click', generateNewToken)
}

function switchTab(tab: 'access' | 'refresh'): void {
  if (tab === 'access') {
    accessTokenTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-500')
    accessTokenTab.classList.remove('text-gray-600')
    refreshTokenTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-500')
    refreshTokenTab.classList.add('text-gray-600')
    accessTokenPanel.classList.remove('hidden')
    refreshTokenPanel.classList.add('hidden')
  } else {
    refreshTokenTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-500')
    refreshTokenTab.classList.remove('text-gray-600')
    accessTokenTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-500')
    accessTokenTab.classList.add('text-gray-600')
    refreshTokenPanel.classList.remove('hidden')
    accessTokenPanel.classList.add('hidden')
  }
}

async function copyToClipboard(text: string, description: string): Promise<void> {
  try {
    await window.api.copyToClipboard(text)
    showNotification(`${description} gekopieerd naar klembord!`, 'success')
  } catch (error) {
    showNotification('Kon niet naar klembord kopiëren', 'error')
    console.error('Copy to clipboard error:', error)
  }
}

function generateNewToken(): void {
  // Reset and go back to school selection to generate a new token
  tokenContainer.classList.add('hidden')
  schoolSelectionContainer.classList.remove('hidden')
}

function setupLoginHandlers(): void {
  // Listen for token generation success
  window.api.onLoginSuccess((data: TokenInfo) => {
    // Verberg het authenticatie laadscherm
    hideAuthLoading()

    // Toon de gegenereerde tokens
    displayTokens(data)

    // Show success message
    showNotification('Token succesvol gegenereerd!', 'success')
    console.log('Token successfully generated:', data)
  })

  // Listen for token generation errors
  window.api.onLoginError((error: string) => {
    // Verberg het authenticatie laadscherm en toon weer de schoolselectie
    hideAuthLoading()
    schoolSelectionContainer.classList.remove('hidden')

    // Show error message
    showNotification(`Token genereren mislukt: ${error}`, 'error')
    console.error('Token generation error:', error)
  })
}

// Nieuwe functie om het authenticatie laadscherm te tonen
function showAuthLoading(): void {
  schoolSelectionContainer.classList.add('hidden')
  tokenContainer.classList.add('hidden')
  authLoadingContainer.classList.remove('hidden')
}

// Nieuwe functie om het authenticatie laadscherm te verbergen
function hideAuthLoading(): void {
  authLoadingContainer.classList.add('hidden')
}

function showNotification(message: string, type: 'success' | 'error'): void {
  const notificationElement = document.createElement('div')
  notificationElement.className =
    type === 'success'
      ? 'fixed top-0 right-0 m-4 p-4 bg-green-100 text-green-800 rounded-md shadow-md'
      : 'fixed top-0 right-0 m-4 p-4 bg-red-100 text-red-800 rounded-md shadow-md'

  notificationElement.innerHTML = `
    <div class="font-medium">${message}</div>
  `

  document.body.appendChild(notificationElement)

  // Remove the notification after a few seconds
  setTimeout(() => {
    notificationElement.remove()
  }, 5000)
}

function displayTokens(tokenInfo: TokenInfo): void {
  // Hide auth loading and show token display
  hideAuthLoading()
  tokenContainer.classList.remove('hidden')

  // Set school name
  schoolNameDisplay.textContent = tokenInfo.tenant

  // Set token values
  accessTokenText.value = tokenInfo.accessToken
  refreshTokenText.value = tokenInfo.refreshToken

  // Generate QR codes with optimized settings for large tokens
  const QRCode = (window as any).QRCode
  if (QRCode) {
    try {
      // Voor access token
      QRCode.toCanvas(accessTokenQR, tokenInfo.accessToken, {
        errorCorrectionLevel: 'L',
        width: 300,
        margin: 1,
        color: {
          dark: '#000',
          light: '#FFF'
        }
      })

      // Voor refresh token
      QRCode.toCanvas(refreshTokenQR, tokenInfo.refreshToken, {
        errorCorrectionLevel: 'L',
        width: 300,
        margin: 1,
        color: {
          dark: '#000',
          light: '#FFF'
        }
      })
    } catch (qrError) {
      console.error('QR code generation error:', qrError)

      // Als QR generatie faalt, toon foutmelding bij de canvas elementen
      const errorMessage = document.createElement('div')
      errorMessage.className = 'text-center text-red-600 p-4'
      errorMessage.textContent = 'Token te lang voor QR code. Gebruik kopiëren naar klembord.'

      // Vervang canvas elementen met foutmelding
      if (accessTokenQR.parentNode) {
        accessTokenQR.style.display = 'none'
        accessTokenQR.parentNode.appendChild(errorMessage.cloneNode(true))
      }

      if (refreshTokenQR.parentNode) {
        refreshTokenQR.style.display = 'none'
        refreshTokenQR.parentNode.appendChild(errorMessage.cloneNode(true))
      }
    }
  }

  // Default to access token tab
  switchTab('access')
}

function handleSearchInput(): void {
  const searchTerm = schoolSearchInput.value.toLowerCase().trim()

  if (searchTerm === '') {
    renderSchoolsList(allSchools)
    return
  }

  const filteredSchools = allSchools.filter(
    (school) =>
      school.naam.toLowerCase().includes(searchTerm) ||
      school.plaats.toLowerCase().includes(searchTerm)
  )

  renderSchoolsList(filteredSchools)
}

async function fetchSchools(): Promise<void> {
  setLoading(true)

  try {
    const response = await fetch(SCHOOLS_API_URL)

    if (!response.ok) {
      throw new Error(`Ophalen van scholen mislukt: ${response.status}`)
    }

    const data = (await response.json()) as SchoolsResponse[]

    // Extract all schools from all organizations
    allSchools = []
    data.forEach((org) => {
      if (org.instellingen && Array.isArray(org.instellingen)) {
        allSchools.push(...org.instellingen)
      }
    })

    // Sort schools alphabetically
    allSchools.sort((a, b) => a.naam.localeCompare(b.naam))

    // Initial render of all schools
    renderSchoolsList(allSchools)
    setLoading(false)
  } catch (error) {
    console.error('Fout bij het ophalen van scholen:', error)
    setError(true)
  }
}

function renderSchoolsList(schools: School[]): void {
  // Clear the current list
  schoolsList.innerHTML = ''

  // Check if we have any schools to display
  if (schools.length === 0) {
    schoolsContainer.classList.remove('hidden')
    noResultsElement.classList.remove('hidden')
    return
  }

  // We have schools to display
  schoolsContainer.classList.remove('hidden')
  noResultsElement.classList.add('hidden')

  // Create list items for each school
  schools.forEach((school) => {
    const listItem = document.createElement('li')
    listItem.className = 'px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors'
    listItem.innerHTML = `
      <div class="font-medium text-gray-900">${school.naam}</div>
      <div class="text-sm text-gray-500">${school.plaats}</div>
    `

    listItem.addEventListener('click', () => selectSchool(school))

    schoolsList.appendChild(listItem)
  })
}

async function selectSchool(school: School): Promise<void> {
  console.log('Geselecteerde school:', school)

  try {
    // Make sure the school has oidcurls
    if (!school.oidcurls || school.oidcurls.length === 0) {
      throw new Error('Deze school heeft geen login-configuratie')
    }

    // Use the first OIDC URL
    const oidcUrl = school.oidcurls[0].url

    // Toon het authenticatie laadscherm
    showAuthLoading()

    // Call the token generation function exposed by the preload script
    try {
      await window.api.login(school.uuid, oidcUrl)
      // We blijven het authenticatie laadscherm tonen totdat we een success of error event ontvangen
    } catch (loginError) {
      // Als de login call zelf faalt, verberg het authenticatie scherm en toon foutmelding
      hideAuthLoading()
      schoolSelectionContainer.classList.remove('hidden')
      throw new Error(`Token genereren mislukt: ${(loginError as Error).message}`)
    }
  } catch (error) {
    console.error('Fout bij het genereren van token:', error)
    showNotification(`Token genereren mislukt: ${(error as Error).message}`, 'error')
  }
}

function setLoading(isLoading: boolean): void {
  if (isLoading) {
    loadingContainer.classList.remove('hidden')
    schoolsContainer.classList.add('hidden')
    errorContainer.classList.add('hidden')
  } else {
    loadingContainer.classList.add('hidden')
    schoolsContainer.classList.remove('hidden')
  }
}

function setError(hasError: boolean): void {
  if (hasError) {
    loadingContainer.classList.add('hidden')
    errorContainer.classList.remove('hidden')
    schoolsContainer.classList.add('hidden')
  } else {
    errorContainer.classList.add('hidden')
  }
}

// Initialize the app
init()
