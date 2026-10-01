import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import type { EmployeeValues } from './types'
import { FormField } from '@/components/common/FormField'

export function EmployeeDriverFields({
  register,
  errors,
}: {
  register: UseFormRegister<EmployeeValues>
  errors: FieldErrors<EmployeeValues>
}) {
  return (
    <div className="dialog-field-grid">
      <FormField label="License number" error={errors.licenseNumber?.message}>
        {(attributes) => (
          <input
            {...attributes}
            className="form-input"
            maxLength={80}
            {...register('licenseNumber')}
          />
        )}
      </FormField>
      <FormField
        label="License classification / restrictions"
        error={errors.licenseClassification?.message}
      >
        {(attributes) => (
          <input
            {...attributes}
            className="form-input"
            maxLength={180}
            {...register('licenseClassification')}
          />
        )}
      </FormField>
      <FormField label="License expiration" error={errors.licenseExpiresOn?.message}>
        {(attributes) => (
          <input
            {...attributes}
            className="form-input"
            type="date"
            {...register('licenseExpiresOn')}
          />
        )}
      </FormField>
      <FormField label="Availability" error={errors.driverAvailability?.message}>
        {(attributes) => (
          <select {...attributes} className="form-input" {...register('driverAvailability')}>
            <option>Available</option>
            <option>Unavailable</option>
          </select>
        )}
      </FormField>
      <p className="form-helper">
        An inactive or unavailable employee cannot start a new assignment. Active assignments also
        affect availability.
      </p>
    </div>
  )
}
