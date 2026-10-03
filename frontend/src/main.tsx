import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/prata'
import '@fontsource-variable/jost'
import App from './App'
import { installTapFeedback } from './lib/motion'
import './index.css'

installTapFeedback()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Synchronous navigation, so a View Transition captures the new page inside flushSync. */}
    <BrowserRouter useTransitions={false}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
