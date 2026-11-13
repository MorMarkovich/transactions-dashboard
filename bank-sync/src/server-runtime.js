// Localhost-only server that backs the dashboard's "רענן מהבנקים" button.
//
// Security:
//  • Binds to 127.0.0.1 only — never exposed to the LAN/internet.
//  • /sync requires a secret token (x-sync-token) stored in the OS keychain.
//  • Origin allow-list + strict CORS — a random website cannot trigger a sync.
import express from 'express'
import { syncJsonParser, safeRequestError } from './request-body.js'
import { safeErrorCode, safeError } from './safe-errors.js'
import { config, assertConfig } from './config.js'
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

    // Chromium sends this header when a public HTTPS dashboard calls a
    // loopback service. Explicitly opt in only for an origin we already trust;
    // without the matching response header some browser versions reject the
    // request before POST /sync is ever sent.
    if (req.headers['access-control-request-private-network'] === 'true') {
      res.setHeader('Access-Control-Allow-Private-Network', 'true')
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-sync-token')
  res.setHeader('Access-Control-Max-Age', '600')
}

export function createSyncApp(token, sync = runSync) {
  let syncing = false
  const app = express()
  app.use(syncJsonParser())

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
    const stream = req.body?.progress === true
    const send = (event) => {
      if (!res.destroyed) res.write(JSON.stringify(event) + '\n')
    }
    try {
      if (stream) {
        res.setHeader('Content-Type', 'application/x-ndjson')
        res.setHeader('Cache-Control', 'no-store')
        res.flushHeaders()
        send({ type: 'progress', stage: 'connecting', percent: 3 })
      }
      const result = await sync((m) => console.log('•', m), {
        onProgress: stream ? (progress) => send({ type: 'progress', ...progress }) : undefined,
      })
      if (stream) send({ type: 'result', result })
      else res.json(result)
    } catch (err) {
      const error = safeErrorCode(err)
      console.error('sync error:', error)
      if (stream) send({ type: 'error', error })
      else res.status(500).json({ success: false, error })
    } finally {
      syncing = false
      if (stream && !res.destroyed) res.end()
    }
  })

  app.use(safeRequestError)

  return app
}

export async function main() {
  assertConfig()

  const { getSecret, SYNC_TOKEN_KEY } = await import('./secrets.js')
  const token = await getSecret(SYNC_TOKEN_KEY)
  if (!token) {
    throw safeError('SYNC_TOKEN_REQUIRED')
  }

  createSyncApp(token).listen(config.port, HOST, () => {
    console.log(`bank-sync listening on http://${HOST}:${config.port}`)
    console.log(`Allowed origins: ${config.allowedOrigins.join(', ')}`)
    console.log('Click "רענן מהבנקים" in the dashboard to trigger a sync.')
  })
}
