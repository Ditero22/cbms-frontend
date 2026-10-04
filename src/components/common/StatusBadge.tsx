import { statusTone } from '@/utils/statusTone'

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`status-badge ${statusTone(value)}`}>
      <i aria-hidden="true" />
      {value}
    </span>
  )
}
