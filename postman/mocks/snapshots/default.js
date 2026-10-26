// PostgREST wire stand-in, not a substitute for PostgreSQL/RLS tests.
const http = require('node:http')
http.createServer(async (req, res) => {
  const json = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)) }
  const url = new URL(req.url, 'http://localhost')
  const cards = await pm.state.get('snapshots.cards') || {}
  if (req.method === 'POST' && url.pathname === '/__reset') { await pm.state.set('snapshots.cards', {}); return json(200, {}) }
  if (req.method === 'GET' && url.pathname === '/rest/v1/pending_card_snapshots') {
    if (url.searchParams.get('user_id') !== 'eq.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') return json(403, { code: '42501' })
    const key = url.searchParams.get('card_key')?.slice(3)
    return json(200, cards[key] ? [cards[key]] : [])
  }
  if (req.method === 'POST' && url.pathname === '/rest/v1/rpc/write_pending_card_snapshot') {
    const { p_card_key: key, p_expected_version: version, p_data: data } = req.body
    if (!key || !Number.isInteger(version) || !data || Object.keys(req.body).length !== 3) return json(400, { code: '22023' })
    if ((cards[key]?.version || 0) !== version) return json(409, { code: 'P0002' })
    cards[key] = { version: version + 1, data }
    await pm.state.set('snapshots.cards', cards)
    return json(200, version + 1)
  }
  return json(501, { error: 'unmodelled' })
}).listen(process.env.PORT)
