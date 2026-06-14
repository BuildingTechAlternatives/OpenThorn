import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { DASHBOARD_TOUR_STEPS } from './quickstart'

/**
 * Runs the first-login dashboard spotlight tour. Steps whose target element is
 * not currently in the DOM (e.g. sidebar hidden on small screens) are skipped.
 * `onComplete` fires once when the tour finishes or is dismissed — the caller
 * uses it to persist the "seen" flag.
 */
export function startDashboardTour(onComplete: () => void): void {
  const steps = DASHBOARD_TOUR_STEPS
    .filter((s) => document.querySelector(s.element))
    .map((s) => ({
      element: s.element,
      popover: { title: s.title, description: s.description },
    }))

  if (steps.length === 0) {
    onComplete()
    return
  }

  let finished = false
  const finishOnce = () => {
    if (finished) return
    finished = true
    onComplete()
  }

  const tour = driver({
    showProgress: true,
    allowClose: true,
    overlayColor: 'rgba(7, 7, 15, 0.7)',
    popoverClass: 'openthorn-tour',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Got it',
    steps,
    onDestroyed: finishOnce,
  })

  tour.drive()
}
