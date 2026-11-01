import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initDiag } from './utils/diag'
import { isTauri } from './platform'

// Freeze/crash diagnostics → %USERPROFILE%\bankolearn-diag.log (desktop only).
if (isTauri) initDiag()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
