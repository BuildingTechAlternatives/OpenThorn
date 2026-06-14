import { supabase } from './supabase'

export interface DeployResult {
  url: string
  siteId: string
}

export async function deploySite(
  projectId: string,
  html: string,
  existingSiteId?: string | null,
): Promise<DeployResult> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new Error('You must be signed in to publish a site.')
  }

  const res = await fetch('/api/deploy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ projectId, html, existingSiteId }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Deploy failed: ${body || res.statusText}`)
  }

  const data2 = await res.json()
  if (!data2?.url || !data2?.siteId) {
    throw new Error('Deploy failed: invalid response from deploy endpoint')
  }

  return {
    url: String(data2.url),
    siteId: String(data2.siteId),
  }
}
