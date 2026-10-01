import { useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { AppDialog } from '@/components/common/AppDialog'
import { FieldHeading } from '@/components/common/FieldHeading'
import { ProofFileField } from '@/components/common/ProofFileField'
import { validatePaymentProof } from '@/components/common/payment-proof'
import { formatPeso, toMinorUnits } from '@/features/modules/order-decimals'
import { philippineDate } from './customer-payments.utils'
import type { CustomerPaymentOptions, CustomerPaymentValues } from './types'
import { customerPaymentMethods } from './payment-methods'

type Props = {
  orderId?: string | null
  options?: CustomerPaymentOptions
  loading: boolean
  optionsError?: string
  submitError?: string
  onRetry: () => void
  onClose: () => void
  onSave: (values: CustomerPaymentValues, requestKey: string, proofFile: File) => Promise<boolean>
}

export function RecordCustomerPaymentDialog({
  orderId,
  options,
  loading,
  optionsError,
  submitError,
  onRetry,
  onClose,
  onSave,
}: Props) {
  const requestKey = useRef(crypto.randomUUID())
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofError, setProofError] = useState('')
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CustomerPaymentValues>({
    defaultValues: {
      orderId: orderId ?? '',
      amount: '',
      method: 'Cash',
      paymentDate: philippineDate(),
      externalReference: '',
      notes: '',
    },
  })
  const selectedId = useWatch({ control, name: 'orderId' })
  const order = options?.find((item) => item.id === selectedId)
  const submit = handleSubmit(async (values) => {
    const error = validatePaymentProof(proofFile)
    setProofError(error)
    if (error || !proofFile) return
    await onSave(values, requestKey.current, proofFile)
  })
  return (
    <AppDialog
      open
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose()
      }}
      title="Record customer payment"
      description="Each receipt is kept separately. Choose an order and record the actual payment received."
    >
      <form className="dialog-form" onSubmit={submit}>
        <label className="field-label">
          <FieldHeading required>Order</FieldHeading>
          <Controller
            name="orderId"
            control={control}
            rules={{ required: 'Choose an order with a remaining balance.' }}
            render={({ field }) => (
              <select
                className="form-input"
                autoFocus
                disabled={loading || Boolean(optionsError) || isSubmitting || !options?.length}
                {...field}
              >
                <option value="">Select order</option>
                {options?.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.orderNumber} · {option.customerName} · Balance{' '}
                    {formatPeso(option.balance)}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.orderId && (
            <span className="field-error" role="alert">
              {errors.orderId.message}
            </span>
          )}
        </label>
        {order && (
          <div className="payment-balance-card">
            <span>Total {formatPeso(order.totalAmount)}</span>
            <span>Net paid {formatPeso(order.paidAmount)}</span>
            <strong>Remaining {formatPeso(order.balance)}</strong>
          </div>
        )}
        <div className="transfer-branch-fields">
          <label className="field-label">
            <FieldHeading required>Amount</FieldHeading>
            <input
              className="form-input"
              type="number"
              min="0.01"
              max={order?.balance}
              step="0.01"
              inputMode="decimal"
              disabled={isSubmitting || !order}
              aria-invalid={Boolean(errors.amount)}
              {...register('amount', {
                required: 'Enter an amount.',
                validate: (value) => {
                  try {
                    const amount = toMinorUnits(value, 2)
                    if (amount <= 0n) return 'Amount must be greater than zero.'
                    return order && amount <= toMinorUnits(order.balance, 2)
                      ? true
                      : 'Amount cannot exceed the remaining balance.'
                  } catch {
                    return 'Enter a positive amount with up to two decimal places.'
                  }
                },
              })}
              placeholder="0.00"
            />
            {errors.amount && (
              <span className="field-error" role="alert">
                {errors.amount.message}
              </span>
            )}
          </label>
          <label className="field-label">
            <FieldHeading required>Method</FieldHeading>
            <select className="form-input" disabled={isSubmitting} {...register('method')}>
              {customerPaymentMethods.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <FieldHeading required>Payment date</FieldHeading>
            <input
              className="form-input"
              type="date"
              max={philippineDate()}
              disabled={isSubmitting}
              {...register('paymentDate', {
                required: 'Choose the payment date.',
                validate: (value) =>
                  value <= philippineDate() || 'Payment date cannot be in the future.',
              })}
            />
            {errors.paymentDate && (
              <span className="field-error" role="alert">
                {errors.paymentDate.message}
              </span>
            )}
          </label>
          <label className="field-label">
            <FieldHeading>Reference number</FieldHeading>
            <input
              className="form-input"
              maxLength={200}
              disabled={isSubmitting}
              {...register('externalReference')}
              placeholder="GCash, bank, cheque, or receipt reference"
            />
          </label>
        </div>
        <label className="field-label">
          <FieldHeading>Notes</FieldHeading>
          <textarea
            className="form-input"
            rows={2}
            maxLength={2000}
            disabled={isSubmitting}
            {...register('notes')}
            placeholder="Optional payment notes"
          />
        </label>
        <ProofFileField
          file={proofFile}
          disabled={isSubmitting}
          error={proofError}
          onChange={(file) => {
            setProofFile(file)
            setProofError('')
          }}
        />
        <p className="form-helper">
          The payment and its proof are saved together. Review the image before confirming.
        </p>
        {loading && (
          <p className="form-helper" role="status">
            Loading unpaid orders…
          </p>
        )}
        {optionsError && (
          <div className="payment-options-error" role="alert">
            <span>{optionsError}</span>
            <button type="button" className="button button-outline" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}
        {!loading && !optionsError && options?.length === 0 && (
          <p className="form-helper">
            There are no orders with an outstanding collectible balance.
          </p>
        )}
        {submitError && (
          <p className="field-error" role="alert">
            {submitError}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-outline"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={isSubmitting || loading || Boolean(optionsError) || !options?.length}
          >
            <Plus size={16} />
            {isSubmitting ? 'Recording payment…' : 'Record payment'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
