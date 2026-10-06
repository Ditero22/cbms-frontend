import { useServerValidation } from '@/components/common/useServerValidation'
import { FormField } from '@/components/common/FormField'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { UseFormRegister } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import type { EmployeeOptions, EmployeeRecord, EmployeeValues } from './types'
import { EmployeeDriverFields } from './EmployeeDriverFields'
import './employee-driver.css'

type EmployeeRecordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeRecord | null
  options?: EmployeeOptions
  isLoadingOptions: boolean
  optionsError?: string
  serverFieldErrors?: Record<string, string>
  saveError?: string
  onRetryOptions: () => void
  onSave: (employeeId: string | null, values: EmployeeValues) => Promise<boolean>
}

export function EmployeeRecordDialog({
  open,
  onOpenChange,
  employee,
  options,
  isLoadingOptions,
  optionsError,
  saveError,
  serverFieldErrors,
  onRetryOptions,
  onSave,
}: EmployeeRecordDialogProps) {
  const {
    setError,
    register,
    handleSubmit,
    reset,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EmployeeValues>()
  const isDriver = useWatch({ control, name: 'isDriver' })

  useEffect(() => {
    if (!open) return
    reset(
      employee
        ? {
            employeeNumber: employee.employeeNumber,
            name: employee.name,
            position: employee.position,
            branchId: employee.branchId,
            email: employee.email ?? '',
            phone: employee.phone ?? '',
            address: employee.address ?? '',
            hiredAt: employee.hiredAt ?? '',
            status: employee.status,
            isDriver: employee.isDriver,
            licenseNumber: employee.licenseNumber ?? '',
            licenseClassification: employee.licenseClassification ?? '',
            licenseExpiresOn: employee.licenseExpiresOn ?? '',
            driverAvailability: employee.driverAvailability,
            emergencyContactName: employee.emergencyContactName ?? '',
            emergencyContactPhone: employee.emergencyContactPhone ?? '',
            notes: employee.notes ?? '',
          }
        : {
            employeeNumber: '',
            name: '',
            position: '',
            branchId: '',
            email: '',
            phone: '',
            address: '',
            hiredAt: '',
            status: 'Active',
            isDriver: false,
            licenseNumber: '',
            licenseClassification: '',
            licenseExpiresOn: '',
            driverAvailability: 'Available',
            emergencyContactName: '',
            emergencyContactPhone: '',
            notes: '',
          },
    )
  }, [employee, open, reset])

  useEffect(() => {
    if (open && !employee && options?.branches.length === 1 && !getValues('branchId'))
      setValue('branchId', options.branches[0].id)
  }, [employee, getValues, open, options, setValue])

  async function submit(values: EmployeeValues) {
    const nullableFields = [
      'licenseNumber',
      'licenseClassification',
      'licenseExpiresOn',
      'emergencyContactName',
      'emergencyContactPhone',
      'notes',
      'address',
    ] as const
    const normalized = { ...values }
    for (const field of nullableFields) normalized[field] = values[field]?.trim() || null
    const saved = await onSave(employee?.id ?? null, normalized)
    if (saved) {
      onOpenChange(false)
      reset()
    }
  }

  useServerValidation(setError, serverFieldErrors)

  return (
    <AppDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isSubmitting) return
        onOpenChange(nextOpen)
        if (!nextOpen) reset()
      }}
      title={employee ? 'Edit employee' : 'Add employee'}
      description="Keep the employee record and branch assignment up to date."
      size="lg"
      hasUnsavedChanges={isDirty}
    >
      <form className="dialog-form" onSubmit={handleSubmit(submit)} aria-busy={isSubmitting}>
        <fieldset className="employee-form-section" disabled={isSubmitting}>
          <legend>Employee information</legend>
          <div className="dialog-field-grid">
            <EmployeeField
              name="employeeNumber"
              label="Employee ID"
              register={register}
              error={errors.employeeNumber?.message}
            />
            <EmployeeField
              name="name"
              label="Full name"
              register={register}
              error={errors.name?.message}
            />
            <EmployeeField
              name="position"
              label="Position"
              register={register}
              error={errors.position?.message}
            />
            <FormField label="Branch" required error={errors.branchId?.message}>
              {(attributes) => (
                <select
                  {...attributes}
                  className="form-input"
                  disabled={isLoadingOptions || (Boolean(optionsError) && !employee)}
                  {...register('branchId', { required: 'Choose a branch.' })}
                >
                  <option value="">
                    {isLoadingOptions ? 'Loading branches…' : 'Select a branch'}
                  </option>
                  {employee &&
                    !options?.branches.some((branch) => branch.id === employee.branchId) && (
                      <option value={employee.branchId}>{employee.branchName} (current)</option>
                    )}
                  {options?.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <EmployeeField
              name="email"
              label="Email"
              type="email"
              register={register}
              error={errors.email?.message}
            />
            <EmployeeField
              name="phone"
              label="Phone"
              type="tel"
              register={register}
              error={errors.phone?.message}
            />
            <FormField label="Hire date" error={errors.hiredAt?.message}>
              {(attributes) => (
                <input
                  {...attributes}
                  className="form-input"
                  type="date"
                  {...register('hiredAt')}
                />
              )}
            </FormField>
            {employee && (
              <FormField label="Status" error={errors.status?.message}>
                {(attributes) => (
                  <select {...attributes} className="form-input" {...register('status')}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                )}
              </FormField>
            )}
          </div>
        </fieldset>
        <fieldset className="employee-form-section" disabled={isSubmitting}>
          <legend>Address and emergency contact</legend>
          <FormField label="Address" error={errors.address?.message}>
            {(attributes) => (
              <textarea
                {...attributes}
                className="form-input"
                rows={2}
                maxLength={400}
                {...register('address')}
              />
            )}
          </FormField>
          <div className="dialog-field-grid">
            <FormField label="Emergency contact name" error={errors.emergencyContactName?.message}>
              {(attributes) => (
                <input
                  {...attributes}
                  className="form-input"
                  maxLength={180}
                  {...register('emergencyContactName')}
                />
              )}
            </FormField>
            <FormField
              label="Emergency contact phone"
              error={errors.emergencyContactPhone?.message}
            >
              {(attributes) => (
                <input
                  {...attributes}
                  className="form-input"
                  type="tel"
                  maxLength={40}
                  {...register('emergencyContactPhone')}
                />
              )}
            </FormField>
          </div>
        </fieldset>
        <fieldset className="employee-form-section" disabled={isSubmitting}>
          <legend>Driver capability</legend>
          <label className="user-cross-branch-toggle">
            <input type="checkbox" {...register('isDriver')} />
            <span>
              <strong>This employee can work as a driver</strong>
              <small>Keep their driver information in this employee record.</small>
            </span>
          </label>
          {isDriver && <EmployeeDriverFields register={register} errors={errors} />}
        </fieldset>
        <FormField label="Notes" error={errors.notes?.message}>
          {(attributes) => (
            <textarea
              {...attributes}
              className="form-input"
              rows={3}
              maxLength={2000}
              disabled={isSubmitting}
              {...register('notes')}
            />
          )}
        </FormField>
        {optionsError && (
          <p className="field-error" role="alert">
            Branch choices could not be loaded.{' '}
            <button
              type="button"
              className="button button-quiet button-small"
              onClick={onRetryOptions}
              disabled={isSubmitting || isLoadingOptions}
            >
              Try again
            </button>
          </p>
        )}
        {saveError && (
          <p className="field-error" role="alert">
            {saveError}
          </p>
        )}
        <div className="dialog-actions">
          <DialogCancelButton disabled={isSubmitting} />
          <button
            type="submit"
            className="button button-primary"
            disabled={isSubmitting || isLoadingOptions || (Boolean(optionsError) && !employee)}
          >
            <Plus size={16} />
            {isSubmitting ? 'Saving…' : employee ? 'Save changes' : 'Create employee'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}

function EmployeeField({
  name,
  label,
  type = 'text',
  register,
  error,
}: {
  name: 'employeeNumber' | 'name' | 'position' | 'email' | 'phone'
  label: string
  type?: string
  register: UseFormRegister<EmployeeValues>
  error?: string
}) {
  const isRequired = ['employeeNumber', 'name', 'position'].includes(name)
  const maxLength = { employeeNumber: 40, name: 180, position: 120, email: 254, phone: 40 }[name]

  return (
    <FormField
      label={label}
      required={isRequired}
      error={error}
      width={name === 'employeeNumber' || name === 'phone' ? 'sm' : 'full'}
    >
      {(attributes) => (
        <input
          {...attributes}
          className="form-input"
          type={type}
          maxLength={maxLength}
          {...register(name, {
            required: isRequired ? `${label} is required.` : false,
            setValueAs: (value: string) => value.trim(),
            validate: (value) => {
              const trimmed = value?.trim() ?? ''
              if (isRequired && !trimmed) return `${label} is required.`
              if ((name === 'name' || name === 'position') && trimmed.length < 2)
                return `${label} must be at least 2 characters.`
              return true
            },
          })}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      )}
    </FormField>
  )
}
