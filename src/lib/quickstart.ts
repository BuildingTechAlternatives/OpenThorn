/** Action taken when a quickstart slide's primary button is pressed. */
export type QuickstartAction =
  | { type: 'advance'; label: string }
  | { type: 'finish'; label: string }
  | { type: 'navigate'; label: string; to: string; state?: Record<string, unknown> }

export interface QuickstartSlide {
  id: string
  heading: string
  body: string
  action: QuickstartAction
}

/**
 * Slides shown to a brand-new user on their first dashboard visit.
 * `navigate` actions close the guide (persisting the flag) and route the user.
 */
export const QUICKSTART_SLIDES: QuickstartSlide[] = [
  {
    id: 'welcome',
    heading: 'Welcome to OpenThorn',
    body: 'OpenThorn builds complete websites from a single prompt — using your own AI provider key.',
    action: { type: 'advance', label: 'Next' },
  },
  {
    id: 'providers',
    heading: 'Connect a provider',
    body: 'Your API key stays yours (BYOK). Add it under Providers in the sidebar to start generating.',
    action: { type: 'navigate', label: 'Go to Providers', to: '/providers' },
  },
  {
    id: 'templates',
    heading: 'Browse Templates',
    body: 'Prefer a head start? Production-ready starting points live under Templates.',
    action: { type: 'navigate', label: 'Open Templates', to: '/templates' },
  },
  {
    id: 'restaurant',
    heading: 'Try the Restaurant Landing template',
    body: 'Open Templates, click a card to preview it, then “Use this template” to customize it with AI.',
    action: {
      type: 'navigate',
      label: 'Open Restaurant template',
      to: '/templates',
      state: { openTemplateId: 'restaurant-landing' },
    },
  },
  {
    id: 'build',
    heading: 'Build & deploy',
    body: 'Describe your idea in the prompt box on the dashboard, then deploy your site when it’s ready.',
    action: { type: 'finish', label: 'Get started' },
  },
]

/** Show the guide only when the persisted flag is explicitly false. */
export function shouldShowQuickstart(hasSeen: boolean | null | undefined): boolean {
  return hasSeen === false
}
