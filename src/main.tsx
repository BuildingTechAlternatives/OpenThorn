import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SupabaseAuthProvider } from './lib/AuthContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SupabaseAuthProvider>
        <App />
      </SupabaseAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
