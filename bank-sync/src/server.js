// Localhost-only server that backs the dashboard's "רענן מהבנקים" button.
//
// Security:
//  • Binds to 127.0.0.1 only — never exposed to the LAN/internet.
//  • /sync requires a secret token (x-sync-token) stored in the OS keychain.
//  • Origin allow-list + strict CORS — a random website cannot trigger a sync.
import express from 'express'
import { config, assertConfig } from './config.js'
import { getSecret, SYNC_TOKEN_KEY } from './secrets.js'
import { runSync, tokensMatch } from './sync.js'

const HOST = '127.0.0.1'

function isAllowedOrigin(origin) {
  // Allow no-Origin requests (curl / same-process CLI), but the browser button
  // always sends one and it must be on the allow-list.
  if (!origin) return true
  return config.allowedOrigins.includes(origin)
}

function applyCors(req, res) {
  const origin = req.headers.origin
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-sync-token')
  res.setHeader('Access-Control-Max-Age', '600')
}

async function main() {
  assertConfig()

  const token = await getSecret(SYNC_TOKEN_KEY)
  if (!token) {
    console.error('No sync token found. Run `npm run setup` first.')
    process.exit(1)
  }

  let syncing = false
  const app = express()
  app.use(express.json({ limit: '256kb' }))

  app.options('/sync', (req, res) => { applyCors(req, res); res.sendStatus(204) })

  app.get('/health', (req, res) => {
    applyCors(req, res)
    res.json({ status: 'ok' })
  })

  app.post('/sync', async (req, res) => {
    applyCors(req, res)

    const origin = req.headers.origin
    if (!isAllowedOrigin(origin)) {
      return res.status(403).json({ success: false, error: `origin not allowed: ${origin}` })
    }
    if (!tokensMatch(req.headers['x-sync-token'] || '', token)) {
      return res.status(401).json({ success: false, error: 'invalid sync token' })
    }
    if (syncing) {
      return res.status(429).json({ success: false, error: 'sync already in progress' })
    }

    syncing = true
    try {
      const result = await runSync((m) => console.log('•', m))
      res.json(result)
    } catch (err) {
      console.error('sync error:', err.message)
      res.status(500).json({ success: false, error: err.message })
    } finally {
      syncing = false
    }
  })

  app.listen(config.port, HOST, () => {
    console.log(`bank-sync listening on http://${HOST}:${config.port}`)
    console.log(`Allowed origins: ${config.allowedOrigins.join(', ')}`)
    console.log('Click "רענן מהבנקים" in the dashboard to trigger a sync.')
  })
}

main().catch((e) => {
  console.error('failed to start:', e.message)
  process.exit(1)
})
