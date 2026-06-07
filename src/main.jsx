import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { UserProvider } from './context/UserContext'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

// Barre de statut bleue sur Android
if (Capacitor.isNativePlatform()) {
  StatusBar.setBackgroundColor({ color: '#1A56DB' })
  StatusBar.setStyle({ style: Style.Dark })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
  </StrictMode>
)