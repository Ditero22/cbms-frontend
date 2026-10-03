import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AppearanceContext,
  type DensityPreference,
  type TextSizePreference,
  type ThemePreference,
} from './appearance-context'

const textSizeStorageKey = (userId: string) => `cbms-text-size:${userId}`

function asTextSize(value: string | undefined): TextSizePreference | null {
  if (value === '1' || value === '2' || value === '3' || value === '4' || value === '5') {
    return Number(value) as TextSizePreference
  }
  return null
}

function savedTheme(): ThemePreference {
  const theme = window.localStorage.getItem('cbms-theme')
  return theme === 'dark' || theme === 'system' ? theme : 'light'
}

function savedDensity(): DensityPreference {
  return window.localStorage.getItem('cbms-density') === 'compact' ? 'compact' : 'comfortable'
}

export function AppearanceProvider({
  children,
  userId,
}: {
  children: ReactNode
  userId: string | null
}) {
  const [theme, setTheme] = useState<ThemePreference>(savedTheme)
  const [density, setDensity] = useState<DensityPreference>(savedDensity)
  const [textSize, setTextSize] = useState<TextSizePreference>(() =>
    userId
      ? (asTextSize(window.localStorage.getItem(textSizeStorageKey(userId)) ?? undefined) ?? 3)
      : (asTextSize(document.documentElement.dataset.textSize) ?? 3),
  )
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const isDark = theme === 'dark' || (theme === 'system' && systemDark)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', updateSystemTheme)
    return () => media.removeEventListener('change', updateSystemTheme)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('cbms-theme', theme)
    window.localStorage.setItem('cbms-density', density)
    if (userId) {
      window.localStorage.setItem(textSizeStorageKey(userId), String(textSize))
      window.localStorage.setItem('cbms-last-user-id', userId)
    }
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    document.documentElement.dataset.density = density
    document.documentElement.dataset.textSize = String(textSize)
  }, [density, isDark, textSize, theme, userId])

  useEffect(() => {
    function syncOtherTab(event: StorageEvent) {
      if (event.key === 'cbms-theme') setTheme(savedTheme())
      if (event.key === 'cbms-density') setDensity(savedDensity())
      if (userId && event.key === textSizeStorageKey(userId)) {
        setTextSize(asTextSize(event.newValue ?? undefined) ?? 3)
      }
    }
    window.addEventListener('storage', syncOtherTab)
    return () => window.removeEventListener('storage', syncOtherTab)
  }, [userId])

  const value = useMemo(
    () => ({ theme, density, textSize, isDark, setTheme, setDensity, setTextSize }),
    [density, isDark, textSize, theme],
  )

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}
