import { useContext } from 'react'
import { AppearanceContext } from './appearance-context'

export function useAppearancePreferences() {
  const preferences = useContext(AppearanceContext)
  if (!preferences) throw new Error('Appearance settings require AppearanceProvider.')
  return preferences
}
