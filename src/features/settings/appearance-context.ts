import { createContext } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type DensityPreference = 'comfortable' | 'compact'
export type TextSizePreference = 1 | 2 | 3 | 4 | 5

export type AppearancePreferences = {
  theme: ThemePreference
  density: DensityPreference
  textSize: TextSizePreference
  isDark: boolean
  setTheme: (theme: ThemePreference) => void
  setDensity: (density: DensityPreference) => void
  setTextSize: (textSize: TextSizePreference) => void
}

export const AppearanceContext = createContext<AppearancePreferences | null>(null)
