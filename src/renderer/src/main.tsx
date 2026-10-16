// Bundled so the app works offline; latin covers every pt-BR accent.
import '@fontsource/lexend/latin-400.css'
import '@fontsource/lexend/latin-600.css'
import '@fontsource/fredoka/latin-600.css'
import '@fontsource/fredoka/latin-700.css'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
