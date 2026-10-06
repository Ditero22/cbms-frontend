import { useId, type ReactNode } from 'react'
import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { FieldHeading } from '@/components/common/FieldHeading'

export type FleetForm = Record<string, string>
export function FleetField({
  name,
  label,
  type = 'text',
  required = false,
  options,
  suggestions,
  register,
  control,
  errors,
  maxLength = 180,
  min,
  max,
  width,
  step,
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  options?: { value: string; label: string }[]
  register: UseFormRegister<FleetForm>
  control: Control<FleetForm>
  errors: FieldErrors<FleetForm>
  maxLength?: number
  max?: string
  width?: 'xs' | 'sm' | 'md' | 'full'
  min?: string
  step?: string
  suggestions?: string[]
}) {
  const fieldId = useId()
  const error = errors[name]?.message
  const inputProps = register(name, {
    required: required ? `${label} is required.` : false,
    validate: (value) => !required || Boolean(value?.trim()) || `${label} is required.`,
  })
  return (
    <div className={`field-label field-${width ?? (type === 'number' ? 'sm' : 'full')}`}>
      <label htmlFor={fieldId}>
        <FieldHeading required={required}>{label}</FieldHeading>
      </label>
      {type === 'select' ? (
        <Controller
          name={name}
          control={control}
          defaultValue=""
          rules={{ required: required ? `${label} is required.` : false }}
          render={({ field }) => (
            <select
              id={fieldId}
              aria-label={label}
              aria-required={required}
              className="form-input"
              {...field}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${fieldId}-error` : undefined}
            >
              <option value="">Select {label.toLowerCase()}</option>
              {options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        />
      ) : type === 'textarea' ? (
        <textarea
          id={fieldId}
          aria-label={label}
          aria-required={required}
          className="form-input"
          rows={3}
          maxLength={maxLength}
          {...inputProps}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : undefined}
        />
      ) : (
        <input
          id={fieldId}
          aria-label={label}
          aria-required={required}
          className="form-input"
          type={type}
          min={min}
          max={max}
          step={step}
          maxLength={maxLength}
          list={suggestions ? `${fieldId}-choices` : undefined}
          {...inputProps}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : undefined}
        />
      )}
      {suggestions && (
        <datalist id={`${fieldId}-choices`}>
          {suggestions.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      )}
      {error && (
        <span id={`${fieldId}-error`} className="field-error" role="alert">
          {String(error)}
        </span>
      )}
    </div>
  )
}
export function FleetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="fleet-form-section">
      <legend>{title}</legend>
      <div className="dialog-field-grid">{children}</div>
    </fieldset>
  )
}
