/**
 * Steps for the first-login dashboard spotlight tour (driver.js). Each step
 * points at a real element via a CSS selector and shows a small anchored popover.
 */
export interface DashboardTourStep {
  /** CSS selector for the element to spotlight. */
  element: string
  title: string
  description: string
}

export const DASHBOARD_TOUR_STEPS: DashboardTourStep[] = [
  {
    element: '[data-tour="providers"]',
    title: 'Connect a provider',
    description:
      'Add your own AI provider key here — OpenAI, Anthropic, Gemini and more. Your key stays yours, and you only pay your provider’s raw rates.',
  },
  {
    element: '[data-tour="templates"]',
    title: 'Start from a template',
    description:
      'Browse ready-made templates. Open one to preview it, then “Use this template” to customize it with AI — try the Restaurant Landing template.',
  },
  {
    element: '[data-tour="prompt"]',
    title: 'Or describe your idea',
    description:
      'Tell OpenThorn what you want to build right here, and the agent generates your whole site live in the browser.',
  },
]

/** Show the tour only when the persisted flag is explicitly false. */
export function shouldShowQuickstart(hasSeen: boolean | null | undefined): boolean {
  return hasSeen === false
}
