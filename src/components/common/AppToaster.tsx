import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'

export function AppToaster() {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 700px)').matches)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    const viewport = window.matchMedia('(max-width: 700px)')
    const updateViewport = (event: MediaQueryListEvent) => setCompact(event.matches)
    const updateTheme = () =>
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    viewport.addEventListener('change', updateViewport)
    updateTheme()
    return () => {
      observer.disconnect()
      viewport.removeEventListener('change', updateViewport)
    }
  }, [])

  return (
    <Toaster
      position={compact ? 'top-center' : 'bottom-right'}
      mobileOffset={{ top: 70, left: 12, right: 12 }}
      theme={theme}
      richColors
      closeButton
    />
  )
}
