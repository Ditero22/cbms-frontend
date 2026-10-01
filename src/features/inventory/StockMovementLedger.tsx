import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { RecordPagination } from '@/components/common/RecordPagination'
import { formatQuantity } from '@/features/modules/order-decimals'
import type { InventoryDetail, InventoryDetailFilters, StockMovement } from './types'
import { stockMovementLabel } from './inventory.utils'

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

function formatChange(value: string | null) {
  if (value === null) return '—'
  const formatted = formatQuantity(value)
  return formatted !== '0' && !formatted.startsWith('-') ? `+${formatted}` : formatted
}

function MovementReference({ movement }: { movement: StockMovement }) {
  return <>{movement.referenceLabel || movement.referenceType || 'Stock adjustment'}</>
}

export function StockMovementLedger({
  detail,
  filters,
  busy,
  onChange,
}: {
  detail: InventoryDetail
  filters: InventoryDetailFilters
  busy: boolean
  onChange: (value: InventoryDetailFilters) => void
}) {
  const id = useId()
  const [movementType, setMovementType] = useState(filters.movementType)
  const [dateFrom, setDateFrom] = useState(filters.dateFrom)
  const [dateTo, setDateTo] = useState(filters.dateTo)
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError('From date must be on or before To date.')
      return
    }
    setError(null)
    onChange({ ...filters, movementType, dateFrom, dateTo, movementPage: 1 })
  }

  return (
    <section className="inventory-ledger" aria-label="Stock movements" aria-busy={busy}>
      <div className="inventory-section-heading">
        <h3>Stock movements</h3>
        <span>
          {detail.movementTotal} recorded {detail.movementTotal === 1 ? 'movement' : 'movements'}
        </span>
      </div>
      <p className="form-helper">
        On-hand changes record physical stock. Reserved changes record stock committed to orders.
        Historical records may not cover the opening balance; this ledger does not reconstruct
        running balances.
      </p>
      <form className="inventory-ledger-filters" onSubmit={submit}>
        <label className="field-label" htmlFor={`${id}-type`}>
          <span>Movement type</span>
          <select
            id={`${id}-type`}
            aria-label="Movement type"
            className="form-input"
            value={movementType}
            onChange={(event) => setMovementType(event.target.value)}
          >
            <option value="">All movements</option>
            {[...new Set([...detail.movementTypes, movementType].filter(Boolean))].map((type) => (
              <option key={type} value={type}>
                {stockMovementLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label" htmlFor={`${id}-from`}>
          <span>From date</span>
          <input
            id={`${id}-from`}
            aria-label="From date"
            type="date"
            className="form-input"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </label>
        <label className="field-label" htmlFor={`${id}-to`}>
          <span>To date</span>
          <input
            id={`${id}-to`}
            aria-label="To date"
            type="date"
            className="form-input"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </label>
        <button type="submit" className="button button-outline" disabled={busy}>
          Apply filters
        </button>
      </form>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {detail.movements.length ? (
        <>
          <div
            className="inventory-ledger-table"
            role="region"
            tabIndex={0}
            aria-label="Stock movement table"
          >
            <table aria-label="Stock movement ledger">
              <thead>
                <tr>
                  <th>Movement</th>
                  <th>On-hand change</th>
                  <th>Reserved change</th>
                  <th>Reference / note</th>
                  <th>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {detail.movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>
                      <strong>{stockMovementLabel(movement.transactionType)}</strong>
                      <small>{formatDate(movement.createdAt)}</small>
                    </td>
                    <td>{formatChange(movement.stockDelta)}</td>
                    <td>{formatChange(movement.reservedDelta)}</td>
                    <td>
                      <MovementReference movement={movement} />
                      {movement.stockDelta === null && movement.reservedDelta === null && (
                        <small>Recorded quantity: {formatChange(movement.quantityDelta)}</small>
                      )}
                      {movement.note && <small>{movement.note}</small>}
                    </td>
                    <td>{movement.performedByName || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="inventory-movement-cards" aria-label="Stock movement cards">
            {detail.movements.map((movement) => (
              <article className="inventory-movement-card" key={movement.id}>
                <header>
                  <strong>{stockMovementLabel(movement.transactionType)}</strong>
                  <time dateTime={movement.createdAt}>{formatDate(movement.createdAt)}</time>
                </header>
                <dl>
                  <div>
                    <dt>On-hand change</dt>
                    <dd>{formatChange(movement.stockDelta)}</dd>
                  </div>
                  <div>
                    <dt>Reserved change</dt>
                    <dd>{formatChange(movement.reservedDelta)}</dd>
                  </div>
                  <div>
                    <dt>Reference</dt>
                    <dd>
                      <MovementReference movement={movement} />
                    </dd>
                  </div>
                  <div>
                    <dt>Recorded by</dt>
                    <dd>{movement.performedByName || 'System'}</dd>
                  </div>
                  {movement.stockDelta === null && movement.reservedDelta === null && (
                    <div>
                      <dt>Recorded quantity</dt>
                      <dd>{formatChange(movement.quantityDelta)}</dd>
                    </div>
                  )}
                </dl>
                {movement.note && <p>{movement.note}</p>}
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="inventory-ledger-empty">
          {filters.movementType || filters.dateFrom || filters.dateTo
            ? 'No stock movements match these filters.'
            : 'No stock movements recorded yet.'}
        </p>
      )}
      <RecordPagination
        label="Stock movement pages"
        page={detail.movementPage}
        pageSize={detail.movementPageSize}
        total={detail.movementTotal}
        busy={busy}
        onPageChange={(movementPage) => onChange({ ...filters, movementPage })}
      />
    </section>
  )
}
