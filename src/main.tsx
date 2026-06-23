import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { TrayApp } from './TrayApp'
import { Toaster } from './components/ui/sonner'
import './styles.css'

const isTray = window.location.search.includes('tray=true');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isTray ? <TrayApp /> : <App />}
    <Toaster />
  </React.StrictMode>,
)
