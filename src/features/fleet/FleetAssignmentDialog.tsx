import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { FleetField, type FleetForm } from './FleetFields'
import { optionalText } from './fleet.utils'
import type { AssignmentValues, FleetOptions } from './types'

export function FleetAssignmentDialog({
  open,
  vehicleId,
  options,
  loading,
  error,
  onRetry,
  onClose,
  onSave,
}: {
  open: boolean
  vehicleId: string
  options?: FleetOptions
  loading: boolean
  error?: string
  onRetry: () => void
  onClose: () => void
  onSave: (values: AssignmentValues) => Promise<boolean>
}) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FleetForm>()
  useEffect(() => {
    if (open) reset({ vehicleId, branchId: '', purpose: '' })
  }, [open, reset, vehicleId])
  useEffect(() => {
    if (open && options?.branches.length === 1 && !getValues('branchId'))
      setValue('branchId', options.branches[0].id)
  }, [getValues, open, options, setValue])
  const branchId = useWatch({ control, name: 'branchId' })
  useEffect(() => {
    const selectedDriver = options?.drivers.find((driver) => driver.id === getValues('driverId'))
    if (selectedDriver && branchId && selectedDriver.branchId !== branchId) setValue('driverId', '')
  }, [branchId, getValues, options, setValue])
  const drivers =
    options?.drivers.filter(
      (driver) =>
        (!branchId || driver.branchId === branchId) && driver.availability !== 'On assignment',
    ) ?? []
  const availableVehicles =
    options?.vehicles.filter((vehicle) => vehicle.status === 'Available') ?? []
  const props = { register, errors, control }
  const submit = handleSubmit(async (values) => {
    const payload: AssignmentValues = {
      vehicleId: values.vehicleId,
      driverId: values.driverId,
      branchId: values.branchId,
      destination: values.destination.trim(),
      purpose: values.purpose.trim(),
      scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : null,
      startOdometer: optionalText(values.startOdometer),
      notes: optionalText(values.notes),
    }
    if (await onSave(payload)) onClose()
  })
  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => !next && !isSubmitting && onClose()}
      title="Assign driver and vehicle"
      description="Reserve eligible resources for a delivery, trip, or service."
      size="md"
      hasUnsavedChanges={isDirty}
    >
      <form className="dialog-form" onSubmit={submit}>
        <fieldset className="fleet-form-section" disabled={isSubmitting}>
          <div className="dialog-field-grid">
            <FleetField
              name="branchId"
              label="Assignment branch"
              type="select"
              required
              options={options?.branches.map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
              {...props}
            />
            <FleetField
              name="vehicleId"
              label="Vehicle"
              type="select"
              required
              options={availableVehicles.map((vehicle) => ({
                value: vehicle.id,
                label: `${vehicle.name} · ${vehicle.plateNumber}`,
              }))}
              {...props}
            />
            <FleetField
              name="driverId"
              label="Driver / employee"
              type="select"
              required
              options={drivers.map((driver) => ({ value: driver.id, label: driver.name }))}
              {...props}
            />
            <FleetField
              name="destination"
              label="Destination"
              required
              maxLength={500}
              {...props}
            />
            <FleetField name="purpose" label="Purpose" required maxLength={240} {...props} />
            <FleetField
              name="scheduledAt"
              label="Scheduled start"
              type="datetime-local"
              {...props}
            />
            <FleetField
              name="startOdometer"
              label="Starting odometer (km)"
              type="number"
              min="0"
              step="0.001"
              {...props}
            />
          </div>
          <FleetField name="notes" label="Notes" type="textarea" maxLength={2000} {...props} />
        </fieldset>
        <p className="form-helper">
          Scheduled assignments reserve the vehicle and driver. To link these resources to an order
          delivery, use <Link to="/deliveries">Schedule delivery</Link>.
        </p>
        {!loading && !error && (!drivers.length || !availableVehicles.length) && (
          <p className="field-error" role="alert">
            {!drivers.length
              ? 'No active, available drivers are available in this branch.'
              : 'No vehicles are currently available for assignment.'}
          </p>
        )}
        {loading && (
          <p className="form-helper" role="status">
            Loading available resources…
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
        <div className="dialog-actions">
          <DialogCancelButton disabled={isSubmitting} />
          <button
            className="button button-primary"
            type="submit"
            disabled={
              isSubmitting ||
              loading ||
              Boolean(error) ||
              !drivers.length ||
              !availableVehicles.length
            }
          >
            {isSubmitting ? 'Saving…' : 'Reserve assignment'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
