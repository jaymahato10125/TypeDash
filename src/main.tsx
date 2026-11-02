import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/roboto-mono/latin-400.css'
import { App } from './app/App'
import './styles/global.css'

const root = document.getElementById('root')

if (!root) throw new Error('TypeDash could not find its application root.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
