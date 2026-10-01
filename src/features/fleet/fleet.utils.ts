export const optionalText = (value: string | undefined) => value?.trim() || null
export const dateInput = (value: string | null | undefined) => value?.slice(0, 10) ?? ''
export function formatFleetDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        ...(value.length > 10 ? { timeStyle: 'short' as const } : {}),
      }).format(date)
}
