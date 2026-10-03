import { useEffect } from 'react'

/** Keep fixed mobile surfaces aligned to the area left visible by the software keyboard. */
export function useVisualViewport() {
  useEffect(() => {
    const rootStyle = document.documentElement.style
    const observedVisualViewport = window.visualViewport

    function updateViewportVariables() {
      const visualViewport = window.visualViewport
      const height = visualViewport?.height ?? window.innerHeight
      const top = visualViewport?.offsetTop ?? 0
      const bottom = Math.max(0, window.innerHeight - top - height)

      rootStyle.setProperty('--cbms-visual-viewport-height', `${Math.round(height)}px`)
      rootStyle.setProperty('--cbms-visual-viewport-top', `${Math.round(top)}px`)
      rootStyle.setProperty('--cbms-visual-viewport-bottom', `${Math.round(bottom)}px`)
      rootStyle.setProperty('--cbms-visual-viewport-center', `${Math.round(top + height / 2)}px`)
    }

    updateViewportVariables()
    observedVisualViewport?.addEventListener('resize', updateViewportVariables)
    observedVisualViewport?.addEventListener('scroll', updateViewportVariables)
    window.addEventListener('resize', updateViewportVariables)

    return () => {
      observedVisualViewport?.removeEventListener('resize', updateViewportVariables)
      observedVisualViewport?.removeEventListener('scroll', updateViewportVariables)
      window.removeEventListener('resize', updateViewportVariables)
      rootStyle.removeProperty('--cbms-visual-viewport-height')
      rootStyle.removeProperty('--cbms-visual-viewport-top')
      rootStyle.removeProperty('--cbms-visual-viewport-bottom')
      rootStyle.removeProperty('--cbms-visual-viewport-center')
    }
  }, [])
}
