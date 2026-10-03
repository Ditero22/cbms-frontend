import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { FieldHeading } from '@/components/common/FieldHeading'
import { getLegacyDeliveryReconciliation, reconcileLegacyDelivery } from './modules.api'

export function LegacyDeliveryReconciliationPanel({
  orderId,
  canReconcile,
}: {
  orderId: string
  canReconcile: boolean
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [deliveryId, setDeliveryId] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const reconciliation = useQuery({
    queryKey: ['legacy-delivery-reconciliation', orderId],
    queryFn: () => getLegacyDeliveryReconciliation(orderId),
    enabled: open && canReconcile,
  })
  const candidates =
    reconciliation.data?.deliveries.filter(
      (delivery) => delivery.allocationStatus === 'Unverified',
    ) ?? []
  const selected = candidates.find((delivery) => delivery.id === deliveryId)

  function changeOpen(next: boolean) {
    if (saving) return
    setOpen(next)
    if (!next) {
      setDeliveryId('')
      setQuantities({})
      setNote('')
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || saving) return
    setSaving(true)
    try {
      await reconcileLegacyDelivery(orderId, selected.id, {
        note: note.trim(),
        items: selected.items.map((item) => ({
          orderItemId: item.orderItemId,
          quantity: quantities[item.orderItemId] ?? item.quantity,
        })),
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['legacy-delivery-reconciliation', orderId] }),
        queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] }),
        queryClient.invalidateQueries({ queryKey: ['delivery-options'] }),
        queryClient.invalidateQueries({ queryKey: ['module', 'orders'] }),
      ])
      setDeliveryId('')
      setQuantities({})
      setNote('')
      toast.success('Historical delivery quantities verified. Stock was not changed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not verify this delivery.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className="order-workflow-actions" aria-label="Historical delivery verification">
        <h3>Verify historical delivery quantities</h3>
        <p className="form-helper">
          These quantities were inferred from older records. Delivery, return, completion, and
          cancellation actions remain blocked until the actual quantities are checked against source
          documents.
        </p>
        {canReconcile ? (
          <button className="button button-outline" onClick={() => setOpen(true)}>
            Verify legacy deliveries
          </button>
        ) : (
          <p className="form-helper">
            Ask a user with delivery update access to verify these records.
          </p>
        )}
      </section>
      <AppDialog
        open={open}
        onOpenChange={changeOpen}
        title="Verify legacy delivery quantities"
        description="Confirm actual quantities from delivery documents. Verification creates an audit record and does not change on-hand stock."
      >
        {reconciliation.isPending ? (
          <p role="status">Loading historical deliveries…</p>
        ) : reconciliation.isError ? (
          <div role="alert" className="employee-detail-state">
            <strong>Could not load historical deliveries.</strong>
            <span>{reconciliation.error.message}</span>
            <button className="button button-outline" onClick={() => void reconciliation.refetch()}>
              Try again
            </button>
          </div>
        ) : candidates.length ? (
          <form className="dialog-form" onSubmit={(event) => void submit(event)}>
            <label className="field-label">
              <FieldHeading required>Historical delivery</FieldHeading>
              <select
                className="form-input"
                value={deliveryId}
                disabled={saving}
                required
                onChange={(event) => {
                  setDeliveryId(event.target.value)
                  setQuantities({})
                  setNote('')
                }}
              >
                <option value="">Choose a delivery to verify</option>
                {candidates.map((delivery) => (
                  <option key={delivery.id} value={delivery.id}>
                    {delivery.reference} · {delivery.status}
                  </option>
                ))}
              </select>
            </label>
            {selected?.items.map((item) => (
              <label className="workflow-line" key={item.orderItemId}>
                <span>
                  <strong>{item.productName}</strong>
                  <small>
                    {item.sku} · {item.orderedQuantity} {item.unit} ordered · inferred quantity{' '}
                    {item.inferredQuantity ?? item.quantity}
                  </small>
                </span>
                <input
                  className="form-input"
                  aria-label={`Delivered quantity for ${item.productName}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={item.orderedQuantity}
                  step="0.001"
                  required
                  disabled={saving}
                  value={quantities[item.orderItemId] ?? item.quantity}
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [item.orderItemId]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
            <label className="field-label">
              <FieldHeading required>Verification note / document reference</FieldHeading>
              <textarea
                className="form-input"
                rows={3}
                minLength={10}
                maxLength={1000}
                value={note}
                required
                disabled={saving}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <DialogCancelButton disabled={saving} />
              <button
                type="submit"
                className="button button-primary"
                disabled={saving || !selected}
              >
                {saving ? 'Verifying…' : 'Confirm delivery quantities'}
              </button>
            </div>
          </form>
        ) : (
          <p className="form-helper">No historical deliveries remain unverified.</p>
        )}
      </AppDialog>
    </>
  )
}
