/**
 * Simule le bouton « Test connection » de ProvidersPage pour RodiumAi.
 *
 * Usage:
 *   set RODIUM_API_KEY=rd_sk_...
 *   node scripts/test-rodiumai-connection.mjs
 *
 * Options:
 *   RODIUM_BASE_URL=https://api.rodiumai.io/v1  (défaut)
 *   RODIUM_ORIGIN=http://localhost:5173         (header Origin pour tester CORS)
 */

const baseUrl = (process.env.RODIUM_BASE_URL ?? 'https://api.rodiumai.io/v1').replace(/\/+$/, '')
const apiKey = process.env.RODIUM_API_KEY?.trim()
const origin = process.env.RODIUM_ORIGIN ?? 'http://localhost:5173'

if (!apiKey) {
  console.error('RODIUM_API_KEY manquant. Ex: set RODIUM_API_KEY=rd_sk_...')
  process.exit(1)
}

const url = `${baseUrl}/models`

console.log(`GET ${url}`)
console.log(`Origin: ${origin}`)

try {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Origin: origin,
    },
  })

  const corsAllowOrigin = response.headers.get('access-control-allow-origin')
  console.log(`HTTP ${response.status}`)
  console.log(`Access-Control-Allow-Origin: ${corsAllowOrigin ?? '(absent)'}`)

  const body = await response.text()
  if (!response.ok) {
    console.error(body.slice(0, 400))
    process.exit(1)
  }

  const payload = JSON.parse(body)
  const models = Array.isArray(payload?.data) ? payload.data : []
  console.log(`Models synced: ${models.length}`)
  if (models.length > 0) {
    console.log('Sample:', models.slice(0, 5).map((m) => m.id ?? m.name).join(', '))
  }
  console.log('OK — même flux que ProvidersPage.testProviderConnection')
} catch (err) {
  console.error('FAILED:', err instanceof Error ? err.message : err)
  if (String(err).includes('fetch failed') || String(err).includes('ECONNREFUSED')) {
    console.error('Vérifiez que le gateway tourne ou que api.rodiumai.io est accessible.')
  }
  process.exit(1)
}
