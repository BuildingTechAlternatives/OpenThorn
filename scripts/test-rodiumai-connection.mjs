/**
 * Simulates the "Test connection" flow from ProvidersPage for RodiumAi.
 *
 * Usage (macOS/Linux):
 *   RODIUM_API_KEY=rd_sk_... node scripts/test-rodiumai-connection.mjs
 *
 * Usage (Windows cmd):
 *   set RODIUM_API_KEY=rd_sk_...
 *   node scripts/test-rodiumai-connection.mjs
 *
 * Options:
 *   RODIUM_BASE_URL=https://api.rodiumai.io/v1  (default)
 *   RODIUM_ORIGIN=http://localhost:5173         (Origin header to test CORS)
 */

const baseUrl = (process.env.RODIUM_BASE_URL ?? 'https://api.rodiumai.io/v1').replace(/\/+$/, '')
const apiKey = process.env.RODIUM_API_KEY?.trim()
const origin = process.env.RODIUM_ORIGIN ?? 'http://localhost:5173'

if (!apiKey) {
  console.error('Missing RODIUM_API_KEY. Example: RODIUM_API_KEY=rd_sk_... node scripts/test-rodiumai-connection.mjs')
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
  console.log('OK — same flow as ProvidersPage.testProviderConnection')
} catch (err) {
  console.error('FAILED:', err instanceof Error ? err.message : err)
  if (String(err).includes('fetch failed') || String(err).includes('ECONNREFUSED')) {
    console.error('Check that the gateway is running and that api.rodiumai.io is reachable.')
  }
  process.exit(1)
}
