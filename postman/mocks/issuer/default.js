// Synthetic issuer contract. Never proxy to a real host.
const http = require('node:http')
http.createServer((req, res) => {
  const json = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)) }
  const mode = req.headers['x-synthetic-mode'] || 'ok'
  if (req.method !== 'POST') return json(501, { error: 'unmodelled' })
  if (req.url.endsWith('/GetCardList')) {
    if (req.body.companyCode !== 11 || req.body.cardSuffixLength !== 4) return json(400, { error: 'invalid_contract' })
    return json(200, { isSuccess: true, errorCode: '0', data: { cardsList: [{ cardSuffix: '1234', companyCode: '11', isPartner: false, isActive: true, cardChargeNext: { period: 'Next', billingDate: mode === 'rollover' ? '15/12/2026' : '15/11/2026' } }] } })
  }
  if (!req.url.endsWith('/GetTransactionsList')) return json(501, { error: 'unmodelled' })
  if (Object.keys(req.body).sort().join(',') !== 'billingMonth,card4Number,cardStatus,companyCode,isNextBillingDate,isPartner' || req.body.card4Number !== '1234' || req.body.companyCode !== 11 || req.body.isPartner !== false || req.body.isNextBillingDate !== true || req.body.cardStatus !== 0 || req.body.billingMonth !== (mode === 'rollover' ? '01/12/2026' : '01/11/2026')) return json(400, { error: 'invalid_contract' })
  if (mode === 'rate') return json(429, { error: 'synthetic' })
  if (mode === 'html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<html>Synthetic challenge</html>') }
  if (mode === 'partial') return json(200, { isSuccess: true, errorCode: '0', data: {} })
  const rows = ['empty', 'rollover'].includes(mode) ? [] : Array.from({ length: 4 }, (_, i) => ({ confirmationLocation: 1, seqConfirmationNumber: `000${i}`, confirmationTimeStamp: `synthetic-${i}`, purchaseDate: '25/10/2026', businessName: `עסקת דוגמה ${i + 1}`, currencyIso: 'ILS', originalAmount: 10 + i }))
  json(200, { isSuccess: true, errorCode: '0', data: { approvals: { approvedTransactions: rows, totalEstimatedAmount: rows.length ? 46 : 0 }, currentTransactionsList: null, israelAbroadVouchers: null } })
}).listen(process.env.PORT)
