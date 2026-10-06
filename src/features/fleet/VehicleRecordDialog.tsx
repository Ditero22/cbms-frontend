import { useServerValidation } from '@/components/common/useServerValidation'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { FleetField, FleetSection, type FleetForm } from './FleetFields'
import { optionalText, dateInput } from './fleet.utils'
import type { FleetOptions, VehicleRecord, VehicleValues } from './types'

export function VehicleRecordDialog({
  open,
  serverFieldErrors,
  submitError,
  onClose,
  record,
  options,
  loading,
  optionsError,
  onRetry,
  onSave,
}: {
  serverFieldErrors?: Record<string, string>
  submitError?: string | null
  open: boolean
  onClose: () => void
  record: VehicleRecord | null
  options?: FleetOptions
  loading: boolean
  optionsError?: string
  onRetry: () => void
  onSave: (id: string | null, values: VehicleValues) => Promise<boolean>
}) {
  const {
    register,
    reset,
    handleSubmit,
    setError,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FleetForm>()
  useEffect(() => {
    if (!open) return
    reset(
      record
        ? {
            ...Object.fromEntries(
              Object.entries(record).map(([key, value]) => [
                key,
                value === null ? '' : String(value),
              ]),
            ),
            registrationExpiresOn: dateInput(record.registrationExpiresOn),
            insuranceExpiresOn: dateInput(record.insuranceExpiresOn),
            nextServiceAt: dateInput(record.nextServiceAt),
          }
        : {},
    )
  }, [open, record, reset])
  const selectedBranchId = useWatch({ control, name: 'branchId' })
  useEffect(() => {
    if (!open || record || options?.branches.length !== 1 || getValues('branchId')) return
    setValue('branchId', options.branches[0].id)
  }, [getValues, open, options?.branches, record, setValue])
  useEffect(() => {
    if (!selectedBranchId) return
    const selectedDriver = options?.drivers.find(
      (driver) => driver.id === getValues('defaultDriverId'),
    )
    if (selectedDriver && selectedDriver.branchId !== selectedBranchId)
      setValue('defaultDriverId', '')
  }, [getValues, options?.drivers, selectedBranchId, setValue])
  const fieldProps = { register, errors, control }
  const submit = handleSubmit(async (values) => {
    if (Boolean(values.capacityValue?.trim()) !== Boolean(values.capacityUnit?.trim())) {
      setError(values.capacityValue ? 'capacityUnit' : 'capacityValue', {
        message: 'Enter both a capacity value and unit.',
      })
      return
    }
    const payload: VehicleValues = {
      branchId: values.branchId || null,
      name: values.name.trim(),
      plateNumber: values.plateNumber.trim(),
      vehicleType: values.vehicleType.trim(),
      brand: optionalText(values.brand),
      model: optionalText(values.model),
      year: values.year ? Number(values.year) : null,
      color: optionalText(values.color),
      fuelType: optionalText(values.fuelType),
      odometer: optionalText(values.odometer),
      capacityValue: optionalText(values.capacityValue),
      capacityUnit: optionalText(values.capacityUnit),
      defaultDriverId: optionalText(values.defaultDriverId),
      registrationExpiresOn: optionalText(values.registrationExpiresOn),
      insuranceProvider: optionalText(values.insuranceProvider),
      insuranceReference: optionalText(values.insuranceReference),
      insuranceExpiresOn: optionalText(values.insuranceExpiresOn),
      nextServiceAt: optionalText(values.nextServiceAt),
      notes: optionalText(values.notes),
    }
    if (await onSave(record?.id ?? null, payload)) onClose()
  })
  const driverOptions =
    options?.drivers
      .filter((driver) => !selectedBranchId || driver.branchId === selectedBranchId)
      .map((driver) => ({ value: driver.id, label: driver.name })) ?? []
  if (
    record?.defaultDriverId &&
    !driverOptions.some((driver) => driver.value === record.defaultDriverId)
  )
    driverOptions.unshift({
      value: record.defaultDriverId,
      label: `${record.defaultDriverName ?? 'Current driver'} (current)`,
    })
  useServerValidation(setError, serverFieldErrors)

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => !next && !isSubmitting && onClose()}
      title={record ? 'Edit vehicle' : 'Add vehicle'}
      description="Keep fleet specifications and the default driver up to date."
      size="md"
      hasUnsavedChanges={isDirty}
    >
      <form aria-busy={isSubmitting} className="dialog-form" onSubmit={submit}>
        <fieldset className="fleet-form-section" disabled={isSubmitting}>
          <FleetSection title="Vehicle identification">
            {!record && (options?.branches.length ?? 0) > 1 && (
              <FleetField
                name="branchId"
                label="Branch"
                type="select"
                required
                options={options?.branches.map((branch) => ({
                  value: branch.id,
                  label: branch.name,
                }))}
                {...fieldProps}
              />
            )}
            <FleetField name="name" label="Vehicle name" required maxLength={120} {...fieldProps} />
            <FleetField
              name="plateNumber"
              label="Plate number"
              required
              maxLength={40}
              {...fieldProps}
            />
            <FleetField
              name="vehicleType"
              label="Vehicle type"
              required
              maxLength={80}
              suggestions={options?.vehicleTypes}
              {...fieldProps}
            />
            <FleetField
              name="defaultDriverId"
              label="Default driver"
              type="select"
              options={driverOptions}
              {...fieldProps}
            />
          </FleetSection>
          <p className="form-helper">
            A default driver is a regular preference. Active work is recorded separately through
            assignments.
          </p>
          <FleetSection title="Specifications">
            <FleetField name="brand" label="Brand" maxLength={80} {...fieldProps} />
            <FleetField name="model" label="Model" maxLength={80} {...fieldProps} />
            <FleetField
              name="year"
              label="Year"
              type="number"
              min="1900"
              max="2200"
              width="xs"
              step="1"
              {...fieldProps}
            />
            <FleetField name="color" label="Color" maxLength={60} {...fieldProps} />
            <FleetField
              name="fuelType"
              label="Fuel type"
              maxLength={60}
              suggestions={['Diesel', 'Gasoline', 'Electric', 'Hybrid', 'Other']}
              {...fieldProps}
            />
            <FleetField
              name="odometer"
              label="Current odometer (km)"
              type="number"
              min="0"
              step="0.001"
              {...fieldProps}
            />
            <FleetField
              name="capacityValue"
              label="Capacity"
              type="number"
              min="0.001"
              step="0.001"
              {...fieldProps}
            />
            <FleetField
              name="capacityUnit"
              label="Capacity unit"
              suggestions={options?.capacityUnits}
              maxLength={40}
              width="sm"
              {...fieldProps}
            />
          </FleetSection>
          <FleetSection title="Registration and servicing">
            <FleetField
              name="registrationExpiresOn"
              label="Registration expiration"
              type="date"
              {...fieldProps}
            />
            <FleetField
              name="nextServiceAt"
              label="Next service date"
              type="date"
              {...fieldProps}
            />
            <FleetField name="insuranceProvider" label="Insurance provider" {...fieldProps} />
            <FleetField name="insuranceReference" label="Insurance reference" {...fieldProps} />
            <FleetField
              name="insuranceExpiresOn"
              label="Insurance expiration"
              type="date"
              {...fieldProps}
            />
          </FleetSection>
          <FleetField name="notes" label="Notes" type="textarea" maxLength={2000} {...fieldProps} />
        </fieldset>
        {loading && (
          <p className="form-helper" role="status">
            Loading driver and vehicle choices…
          </p>
        )}
        {optionsError && (
          <div className="field-error" role="alert">
            {optionsError}
            <button type="button" className="button button-quiet" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}
        {record?.assignedDriver && !record.defaultDriverId && (
          <p className="form-helper">
            Previous driver label: {record.assignedDriver}. Choose an employee to establish the
            driver relationship.
          </p>
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
            disabled={isSubmitting || loading || Boolean(optionsError)}
          >
            {isSubmitting ? 'Saving…' : record ? 'Save changes' : 'Add vehicle'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
