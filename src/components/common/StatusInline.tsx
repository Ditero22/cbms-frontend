import { statusTone } from '@/utils/statusTone'

type StatusInlineProps = { status: string }

export function StatusInline({ status }: StatusInlineProps) {
  return (
    <span className={`inline-status ${statusTone(status)}`}>
      <i />
      {status}
    </span>
  )
}
