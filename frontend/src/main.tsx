import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './styles/components.css'

// After a deploy the content-hashed chunk files this running shell references
// no longer exist on the server, so lazy route imports fail. Vite surfaces
// that as a preload error — reload once to pick up the new index.html
// (served with no-cache) and its fresh chunk graph.
function reloadOnce(): void {
  const last = Number(sessionStorage.getItem('chunk-reload-at') || 0)
  if (Date.now() - last > 60_000) {
    sessionStorage.setItem('chunk-reload-at', String(Date.now()))
    window.location.reload()
  }
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadOnce()
})

// ── Stale-build self-check ───────────────────────────────────────────────
// A tab can outlive many deploys, and copies cached before the no-cache
// header shipped can survive normal reloads for days — the user then runs
// a weeks-old app against a new backend. Compare the entry bundle the
// server currently references (fetched past every cache) with the one
// actually running, and reload when they differ. Runs at startup, whenever
// the tab regains focus, and every 5 minutes.
function runningBundle(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[src*="/assets/index-"]')
  return el ? new URL(el.src, window.location.origin).pathname : null
}

async function reloadIfNewBuild(): Promise<void> {
  const running = runningBundle()
  if (!running) return // dev server — no hashed entry bundle
  try {
    const res = await fetch('/', { cache: 'no-store' })
    const html = await res.text()
    const served = html.match(/\/assets\/index-[\w-]+\.js/)?.[0]
    if (served && served !== running) reloadOnce()
  } catch {
    // offline / server cold-starting — try again on the next trigger
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void reloadIfNewBuild()
})
setInterval(() => void reloadIfNewBuild(), 5 * 60_000)
void reloadIfNewBuild()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
