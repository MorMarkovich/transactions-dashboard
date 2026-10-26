// Upstream 6.9.0 initializes outside its cleanup boundary. Own that boundary
// here as well, including initialization failures. The parent process owns the
// hard deadline, so a stuck native call cannot also block its watchdog.
export async function withScraperCleanup(scraper, run, onStage = () => {}) {
  const original = scraper.terminate
  let cleanup
  scraper.terminate = function (...args) {
    if (!cleanup) {
      onStage('cleanup')
      cleanup = Promise.resolve().then(() => original.apply(this, args))
    }
    return cleanup
  }
  try {
    onStage('scrape')
    return await run()
  } finally {
    try { await scraper.terminate(false) }
    finally { scraper.terminate = original }
  }
}
