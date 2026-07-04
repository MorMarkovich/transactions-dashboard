import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './styles/components.css'

// After a deploy the content-hashed chunk files this running shell references
// no longer exist on the server, so lazy route imports fail. Vite surfaces
// that as a preload error — reload once to pick up the new index.html
// (served with no-cache) and its fresh chunk graph.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const last = Number(sessionStorage.getItem('chunk-reload-at') || 0)
  if (Date.now() - last > 60_000) {
    sessionStorage.setItem('chunk-reload-at', String(Date.now()))
    window.location.reload()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
