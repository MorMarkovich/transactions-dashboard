// Offline supervisor fixture: no imports, filesystem or network access.
process.once('message', ({ credentials }) => {
  if (credentials.mode === 'hang') {
    process.on('SIGTERM', () => {})
    process.send({ type: 'stage', stage: 'scrape' })
    setInterval(() => {}, 1000)
  } else if (credentials.mode === 'crash') process.exit(1)
  else {
    process.send({ type: 'result', ...(credentials.mode === 'error' ? { error: 'BANK_INVALID_PASSWORD' } : { value: { transactions: [{ description: 'Synthetic posted' }], pending: null } }) }, () => process.exit(0))
  }
})
