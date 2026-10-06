import { useServerValidation } from '@/components/common/useServerValidation'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { formatPeso, fromMinorUnits, toMinorUnits } from '@/features/modules/order-decimals'
import { FleetField, FleetSection, type FleetForm } from './FleetFields'
import { optionalText } from './fleet.utils'
import type { FleetOptions, MaintenanceRecord, MaintenanceValues } from './types'

export function MaintenanceRecordDialog({
  open,
  serverFieldErrors,
  submitError,
  onClose,
  record,
  options,
  loading,
  error,
  onRetry,
  onSave,
}: {
  serverFieldErrors?: Record<string, string>
  submitError?: string | null
  open: boolean
  onClose: () => void
  record: MaintenanceRecord | null
  options?: FleetOptions
  loading: boolean
  error?: string
  onRetry: () => void
  onSave: (id: string | null, values: MaintenanceValues) => Promise<boolean>
}) {
  const {
    setError,
    register,
    reset,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FleetForm>()
  useEffect(() => {
    if (open)
      reset(
        record
          ? Object.fromEntries(
              Object.entries(record).map(([key, value]) => [
                key,
                value === null ? '' : String(value),
              ]),
            )
          : { laborCost: '0.00', partsCost: '0.00', otherCost: '0.00' },
      )
  }, [open, record, reset])
  useEffect(() => {
    if (open && !record && options?.branches.length === 1 && !getValues('branchId'))
      setValue('branchId', options.branches[0].id)
  }, [getValues, open, options, record, setValue])
  const costs = useWatch({ control, name: ['laborCost', 'partsCost', 'otherCost'] })
  let total = '0.00'
  try {
    total = fromMinorUnits(
      costs.reduce((sum, value) => sum + toMinorUnits(value || '0', 2), 0n),
      2,
    )
  } catch {
    /* Incomplete input is validated on submit. */
  }
  const props = { register, errors, control }
  const submit = handleSubmit(async (values) => {
    const payload: MaintenanceValues = {
      branchId: record?.branchId ?? values.branchId,
      maintenanceType: values.maintenanceType.trim(),
      description: values.description.trim(),
      problemReported: optionalText(values.problemReported),
      startedOn: optionalText(values.startedOn),
      serviceProvider: optionalText(values.serviceProvider),
      contactPerson: optionalText(values.contactPerson),
      laborCost: values.laborCost || '0.00',
      partsCost: values.partsCost || '0.00',
      otherCost: values.otherCost || '0.00',
      receiptReference: optionalText(values.receiptReference),
      notes: optionalText(values.notes),
    }
    if (await onSave(record?.id ?? null, payload)) onClose()
  })
  useServerValidation(setError, serverFieldErrors)

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => !next && !isSubmitting && onClose()}
      title={record ? 'Edit maintenance record' : 'Schedule maintenance'}
      description="Record the repair problem, provider, and itemized expenses."
      size="lg"
      hasUnsavedChanges={isDirty}
    >
      <form aria-busy={isSubmitting} className="dialog-form" onSubmit={submit}>
        <fieldset className="fleet-form-section" disabled={isSubmitting}>
          <FleetSection title="Maintenance information">
            {!record && (
              <FleetField
                name="branchId"
                label="Expense branch"
                type="select"
                required
                options={options?.branches.map((branch) => ({
                  value: branch.id,
                  label: branch.name,
                }))}
                {...props}
              />
            )}
            <FleetField
              name="maintenanceType"
              label="Maintenance / repair type"
              required
              maxLength={120}
              suggestions={options?.maintenanceTypes}
              {...props}
            />
            <FleetField
              name="description"
              label="Description"
              required
              maxLength={500}
              {...props}
            />
            <FleetField
              name="problemReported"
              label="Problem reported"
              type="textarea"
              maxLength={1000}
              {...props}
            />
            <FleetField name="startedOn" label="Start date" type="date" {...props} />
            <FleetField name="serviceProvider" label="Service provider / repair shop" {...props} />
            <FleetField name="contactPerson" label="Mechanic / contact person" {...props} />
          </FleetSection>
          <FleetSection title="Maintenance & Repair Expenses">
            <FleetField
              name="laborCost"
              label="Labor cost (PHP)"
              type="number"
              min="0"
              step="0.01"
              {...props}
            />
            <FleetField
              name="partsCost"
              label="Parts cost (PHP)"
              type="number"
              min="0"
              step="0.01"
              {...props}
            />
            <FleetField
              name="otherCost"
              label="Other expenses (PHP)"
              type="number"
              min="0"
              step="0.01"
              {...props}
            />
            <FleetField name="receiptReference" label="Receipt / reference number" {...props} />
          </FleetSection>
          <div className="fleet-form-total">
            <span>Total recorded expense</span>
            <strong>{formatPeso(total)}</strong>
          </div>
          <FleetField name="notes" label="Notes" type="textarea" maxLength={2000} {...props} />
        </fieldset>
        <p className="form-helper">
          Receipts can be attached after this record is saved. Completing maintenance posts its
          recorded expense.
        </p>
        {loading && (
          <p className="form-helper" role="status">
            Loading maintenance choices…
          </p>
        )}
        {error && (
          <div className="field-error" role="alert">
            {error}
            <button type="button" className="button button-quiet" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}
        {submitError && (
          <p className="field-error" role="alert">
            {submitError}
          </p>
        )}
        <div className="dialog-actions">
          <DialogCancelButton disabled={isSubmitting} />
          <button
            type="submit"
            className="button button-primary"
            disabled={isSubmitting || loading || Boolean(error)}
          >
            {isSubmitting ? 'Saving…' : record ? 'Save changes' : 'Schedule maintenance'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
