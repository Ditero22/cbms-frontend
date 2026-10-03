import { FieldHeading } from '@/components/common/FieldHeading'
import { useEffect, useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import type { CreateDeliveryValues, DeliveryOptions } from './types'
import type { FleetOptions } from '@/features/fleet/types'

type DeliveryFormValues = {
  orderId: string
  destination: string
  driverId: string
  vehicleId: string
  scheduledAt: string
  items: { orderItemId: string; selected: boolean; quantity: string }[]
}

type CreateDeliveryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (values: CreateDeliveryValues) => Promise<boolean>
  options?: DeliveryOptions
  isLoadingOptions: boolean
  canAssign?: boolean
  fleetOptions?: FleetOptions
  isLoadingFleet?: boolean
  fleetError?: string
  onRetryFleet?: () => void
}

export function CreateDeliveryDialog({
  open,
  onOpenChange,
  onCreate,
  options,
  isLoadingOptions,
  canAssign = false,
  fleetOptions,
  isLoadingFleet = false,
  fleetError,
  onRetryFleet,
}: CreateDeliveryDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DeliveryFormValues>({
    defaultValues: {
      orderId: '',
      destination: '',
      driverId: '',
      vehicleId: '',
      scheduledAt: '',
      items: [],
    },
  })
  const orderId = useWatch({ control, name: 'orderId' })
  const selectedItems = useWatch({ control, name: 'items' })
  const selectedOrder = options?.find((order) => order.id === orderId)
  const canSubmit = Boolean(options?.length)
  const selectedItemCount = selectedItems?.filter((item) => item.selected).length ?? 0
  const initializedOrder = useRef<string | null>(null)
  const drivers =
    fleetOptions?.drivers.filter(
      (driver) =>
        driver.branchId === selectedOrder?.branchId && driver.availability !== 'On assignment',
    ) ?? []
  const vehicles = fleetOptions?.vehicles.filter((vehicle) => vehicle.status === 'Available') ?? []

  useEffect(() => {
    const order = options?.find((candidate) => candidate.id === orderId)
    if (!order || initializedOrder.current === orderId) return
    initializedOrder.current = orderId
    setValue('destination', order?.defaultDestination ?? '')
    setValue(
      'items',
      (order?.items ?? []).map((item) => ({
        orderItemId: item.orderItemId,
        selected: false,
        quantity: '0',
      })),
    )
    setValue('driverId', '')
    setValue('vehicleId', '')
  }, [options, orderId, setValue])

  const submit = handleSubmit(async (values) => {
    if (Boolean(values.driverId) !== Boolean(values.vehicleId)) {
      setError(values.driverId ? 'vehicleId' : 'driverId', {
        message: 'Select both a driver and a vehicle, or leave both unassigned.',
      })
      return
    }
    const deliveryValues: CreateDeliveryValues = {
      orderId: values.orderId,
      destination: values.destination,
      driverId: values.driverId || undefined,
      vehicleId: values.vehicleId || undefined,
      scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : undefined,
      items: values.items
        .filter((item) => item.selected && Number(item.quantity) > 0)
        .map(({ orderItemId, quantity }) => ({ orderItemId, quantity })),
    }
    if (!deliveryValues.items.length) return
    if (await onCreate(deliveryValues)) {
      reset()
      initializedOrder.current = null
    }
  })

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting) return
    onOpenChange(nextOpen)
    if (!nextOpen) {
      reset()
      initializedOrder.current = null
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Schedule delivery"
      description="Choose the order lines and quantities to include in this delivery."
      hasUnsavedChanges={isDirty}
    >
      <form className="dialog-form" onSubmit={submit}>
        <label className="field-label">
          <FieldHeading required>Order</FieldHeading>
          <select
            className="form-input"
            aria-label="Order"
            autoFocus
            disabled={isLoadingOptions || isSubmitting || !options?.length}
            {...register('orderId', { required: 'Choose an order.' })}
          >
            <option value="">Select order</option>
            {options?.map((order) => (
              <option key={order.id} value={order.id}>
                {order.orderNumber} · {order.customerName}
              </option>
            ))}
          </select>
          {errors.orderId && <span className="field-error">{errors.orderId.message}</span>}
        </label>

        {selectedOrder && (
          <fieldset className="delivery-item-picker">
            <legend>Items for this delivery</legend>
            {selectedOrder.items.map((item, index) => (
              <div className="delivery-item-picker-row" key={item.orderItemId}>
                <label className="delivery-item-picker-product">
                  <input
                    type="checkbox"
                    disabled={isSubmitting}
                    {...register(`items.${index}.selected`)}
                  />
                  <span>
                    <strong>{item.productName}</strong>
                    <small>
                      {item.sku} · {item.remainingQuantity} {item.unit} remaining
                    </small>
                  </span>
                </label>
                <label className="delivery-item-picker-quantity">
                  <span className="sr-only">Quantity for {item.productName}</span>
                  <input
                    className="form-input"
                    type="number"
                    min="0.001"
                    max={item.remainingQuantity}
                    step="0.001"
                    inputMode="decimal"
                    required={Boolean(selectedItems?.[index]?.selected)}
                    disabled={isSubmitting || !selectedItems?.[index]?.selected}
                    {...register(`items.${index}.quantity`, {
                      validate: (value) => {
                        if (!selectedItems?.[index]?.selected) return true
                        const quantity = Number(value)
                        return quantity > 0 && quantity <= Number(item.remainingQuantity)
                          ? true
                          : `Enter a quantity from 0.001 to ${item.remainingQuantity}.`
                      },
                    })}
                    aria-invalid={Boolean(errors.items?.[index]?.quantity)}
                  />
                  {errors.items?.[index]?.quantity && (
                    <span className="field-error">{errors.items[index]?.quantity?.message}</span>
                  )}
                </label>
              </div>
            ))}
          </fieldset>
        )}

        <label className="field-label">
          <FieldHeading required>Destination</FieldHeading>
          <input
            className="form-input"
            aria-label="Destination"
            disabled={isSubmitting}
            maxLength={500}
            {...register('destination', {
              required: 'Enter a destination.',
              minLength: { value: 3, message: 'Enter at least three characters.' },
            })}
            placeholder="Customer delivery address"
          />
          {errors.destination && <span className="field-error">{errors.destination.message}</span>}
        </label>

        <div className="transfer-branch-fields">
          <label className="field-label">
            Schedule
            <input
              className="form-input"
              type="datetime-local"
              disabled={isSubmitting}
              {...register('scheduledAt')}
            />
          </label>
        </div>

        {canAssign ? (
          <fieldset
            className="employee-form-section"
            disabled={isSubmitting || isLoadingFleet || Boolean(fleetError) || !selectedOrder}
          >
            <legend>Driver and vehicle (optional)</legend>
            <div className="dialog-field-grid">
              <label className="field-label">
                Driver / employee
                <select
                  className="form-input"
                  aria-label="Driver / employee"
                  {...register('driverId')}
                >
                  <option value="">Unassigned</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
                {errors.driverId && (
                  <span className="field-error" role="alert">
                    {errors.driverId.message}
                  </span>
                )}
              </label>
              <label className="field-label">
                Vehicle
                <select className="form-input" aria-label="Vehicle" {...register('vehicleId')}>
                  <option value="">Unassigned</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} · {vehicle.plateNumber}
                      {vehicle.capacityValue
                        ? ` · ${vehicle.capacityValue} ${vehicle.capacityUnit}`
                        : ''}
                    </option>
                  ))}
                </select>
                {errors.vehicleId && (
                  <span className="field-error" role="alert">
                    {errors.vehicleId.message}
                  </span>
                )}
              </label>
            </div>
            <p className="form-helper">
              Choosing both reserves the resources. Inactive, unavailable, or conflicting resources
              are rejected by the server.
            </p>
          </fieldset>
        ) : (
          <p className="form-helper">
            Your role can schedule deliveries. An authorized fleet operator can assign the driver
            and vehicle.
          </p>
        )}
        {canAssign && isLoadingFleet && (
          <p className="form-helper" role="status">
            Loading available fleet resources…
          </p>
        )}
        {canAssign && fleetError && (
          <p className="field-error" role="alert">
            {fleetError}{' '}
            {onRetryFleet && (
              <button type="button" className="button button-quiet" onClick={onRetryFleet}>
                Try again
              </button>
            )}
          </p>
        )}

        {isLoadingOptions && <p className="form-helper">Loading eligible orders…</p>}
        {!isLoadingOptions && !canSubmit && (
          <p className="form-helper">There are no orders ready for a new delivery.</p>
        )}
        {selectedOrder && !selectedOrder.items.length && (
          <p className="form-helper">No undelivered quantities are available on this order.</p>
        )}
        {selectedOrder?.items.length ? (
          <p className="form-helper">Select at least one line and enter its delivery quantity.</p>
        ) : null}

        <div className="dialog-actions">
          <DialogCancelButton disabled={isSubmitting} />
          <button
            type="submit"
            className="button button-primary"
            disabled={isSubmitting || isLoadingOptions || !canSubmit || !selectedItemCount}
          >
            <Plus size={16} />
            {isSubmitting ? 'Saving delivery…' : 'Schedule delivery'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
