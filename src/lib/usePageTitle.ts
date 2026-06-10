import { useEffect } from 'react'

const SITE_NAME = 'OpenThorn'
const DEFAULT_TITLE = 'OpenThorn — The BYOK AI Website Builder'
const DEFAULT_DESCRIPTION =
  'OpenThorn is the BYOK AI website builder — describe what you want, get a complete, deployable website. No subscription, no lock-in.'
const SITE_URL = 'https://www.openthorn.app'
const DEFAULT_OG_IMAGE = 'https://www.openthorn.app/og-card.png'

interface PageMeta {
  /** Meta description for this page. Falls back to the site default when omitted. */
  description?: string
  /** Absolute URL for og:image and twitter:image. Falls back to site logo when omitted. */
  image?: string
}

function setMetaContent(selector: string, value: string) {
  const el = document.head.querySelector<HTMLMetaElement>(selector)
  if (el) el.setAttribute('content', value)
}

function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)
}

function applyMeta(title: string, description: string, url: string, image: string) {
  document.title = title
  setMetaContent('meta[name="description"]', description)
  setMetaContent('meta[property="og:title"]', title)
  setMetaContent('meta[property="og:description"]', description)
  setMetaContent('meta[property="og:url"]', url)
  setMetaContent('meta[property="og:image"]', image)
  setMetaContent('meta[name="twitter:title"]', title)
  setMetaContent('meta[name="twitter:description"]', description)
  setMetaContent('meta[name="twitter:image"]', image)
  setCanonical(url)
}

/**
 * Sets the document title and the full set of SEO/social meta tags
 * (description, Open Graph, Twitter card, canonical) for the current route.
 * This is a client-side SPA, so these update on navigation; on unmount the tags
 * are restored to the site defaults so a page that sets no meta never inherits
 * a previous route's values.
 */
export function usePageTitle(title?: string, meta?: PageMeta) {
  const description = meta?.description
  const image = meta?.image
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_NAME}` : DEFAULT_TITLE
    const desc = description || DEFAULT_DESCRIPTION
    const url = SITE_URL + window.location.pathname
    const img = image || DEFAULT_OG_IMAGE

    applyMeta(fullTitle, desc, url, img)

    return () => {
      applyMeta(DEFAULT_TITLE, DEFAULT_DESCRIPTION, SITE_URL + window.location.pathname, DEFAULT_OG_IMAGE)
    }
  }, [title, description, image])
}
