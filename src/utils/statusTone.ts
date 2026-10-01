export type StatusTone = 'good' | 'warning' | 'danger' | 'neutral'

export function statusTone(value: string): StatusTone {
  const status = value.toLowerCase()
  const explicit: Record<string, StatusTone> = {
    'partially paid': 'warning',
    unpaid: 'warning',
    'on service': 'warning',
    'under maintenance': 'warning',
    unavailable: 'neutral',
    received: 'good',
    released: 'good',
    scheduled: 'neutral',
    'in progress': 'warning',
  }
  if (explicit[status]) return explicit[status]
  if (
    /\b(active|paid|approved|completed|delivered|available|ready|processed)\b|\bin stock\b/.test(
      status,
    )
  )
    return 'good'
  if (/\b(pending|low|transit|processing|preparing|draft|review|leave|setup)\b/.test(status))
    return 'warning'
  if (
    /\b(inactive|rejected|restricted|overdue)\b|\b(out of stock|cancelled|canceled)\b/.test(status)
  )
    return 'danger'
  return 'neutral'
}
