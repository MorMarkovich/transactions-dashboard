import { fork } from 'node:child_process'
import { safeError, safeErrorCode, assertSafeDebugEnvironment } from './safe-errors.js'

const stages = new Set(['starting', 'browser_ready', 'scrape', 'cleanup'])
let cleanupRequired = false
export const needsScraperCleanup = () => cleanupRequired

// No credentials in argv/env, no inherited debug flags or dependency output.
// A forced stop cannot prove Chrome exited (especially a macOS kernel wait).
// Retain the sync lock and stop the run in that case, rather than retrying.
export function superviseScrape(provider, credentials, options = {}, {
  workerUrl = new URL('./scrape-worker.js', import.meta.url),
  deadlineMs = 300_000,
  killGraceMs = 2_000,
  spawn = fork,
} = {}) {
  assertSafeDebugEnvironment()
  if (cleanupRequired) return Promise.reject(safeError('BANK_CLEANUP_REQUIRED'))
  if (!Number.isFinite(deadlineMs) || deadlineMs < 1 || deadlineMs > 600_000 ||
      !Number.isFinite(killGraceMs) || killGraceMs < 1 || killGraceMs > 5_000) {
    return Promise.reject(safeError('BANK_SCRAPE_FAILED'))
  }
  const { onStage = () => {}, ...serializable } = options
  const env = {}
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'LANG', 'TZ', 'SystemRoot', 'SystemDrive', 'USERPROFILE', 'LOCALAPPDATA']) {
    if (process.env[key]) env[key] = process.env[key]
  }
  return new Promise((resolve, reject) => {
    let child, result, settled = false, stopping = false, timer, killTimer, finishTimer
    const stage = value => { try { onStage(value) } catch { /* UI must not break cleanup */ } }
    const finish = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer); clearTimeout(killTimer); clearTimeout(finishTimer)
      process.off('SIGINT', stop); process.off('SIGTERM', stop)
      if (error) reject(error)
      else resolve(result.value)
    }
    const stop = () => {
      if (settled || stopping) return
      stopping = true
      cleanupRequired = true
      try { child.kill('SIGTERM') } catch { /* still keep the lock */ }
      killTimer = setTimeout(() => {
        try { child.kill('SIGKILL') } catch { /* never target other processes */ }
        finishTimer = setTimeout(() => {
          child.unref()
          if (child.connected) child.disconnect()
          finish(safeError('BANK_CLEANUP_REQUIRED'))
        }, killGraceMs)
      }, killGraceMs)
    }
    try {
      child = spawn(workerUrl, [], { env, execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
    } catch { finish(safeError('BANK_SCRAPE_FAILED')); return }
    process.on('SIGINT', stop); process.on('SIGTERM', stop)
    timer = setTimeout(stop, deadlineMs)
    stage('starting')
    child.on('message', message => {
      if (stopping) return
      if (message?.type === 'stage' && stages.has(message.stage)) stage(message.stage)
      if (message?.type === 'result' && !result) result = message
    })
    child.once('error', () => {
      if (child.pid) stop()
      else finish(safeError('BANK_SCRAPE_FAILED'))
    })
    child.once('exit', (code) => {
      if (stopping || code !== 0 || !result) {
        cleanupRequired = true
        finish(safeError('BANK_CLEANUP_REQUIRED'))
      } else if (result.error) {
        if (result.error === 'BANK_CLEANUP_REQUIRED') cleanupRequired = true
        finish(safeError(safeErrorCode({code: result.error}, 'BANK_SCRAPE_FAILED')))
      } else if (!Array.isArray(result.value?.transactions)) {
        finish(safeError('BANK_SCRAPE_FAILED'))
      } else finish()
    })
    child.send({ provider, credentials, options: serializable }, error => { if (error) stop() })
  })
}
