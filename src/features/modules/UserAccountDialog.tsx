import { FieldHeading } from '@/components/common/FieldHeading'
import { useEffect, useId } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import type { UserAccountRecord, UserAccountValues, UserManagementOptions } from './types'
import { PasswordRequirements } from '@/features/users/PasswordRequirements'
import { isStrongPassword } from '@/features/users/password-policy'

type UserAccountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (userId: string | null, values: UserAccountValues) => Promise<boolean>
  user?: UserAccountRecord | null
  options?: UserManagementOptions
  isLoadingOptions: boolean
  optionsError?: string
  submitError?: string
  onRetryOptions: () => void
}

type UserFormValues = {
  name: string
  email: string
  password: string
  confirmPassword: string
  roleId: string
  branchId: string
  isCrossBranch: boolean
}

export function UserAccountDialog({
  open,
  onOpenChange,
  onSave,
  user,
  options,
  isLoadingOptions,
  optionsError,
  submitError,
  onRetryOptions,
}: UserAccountDialogProps) {
  const formId = useId()
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      roleId: '',
      branchId: '',
      isCrossBranch: false,
    },
  })
  const isEditing = Boolean(user)
  const isCrossBranch = watch('isCrossBranch')
  const roleId = watch('roleId')
  const password = watch('password')
  const selectedRole = options?.roles.find((role) => role.id === roleId)

  useEffect(() => {
    if (!open) return
    reset({
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      confirmPassword: '',
      roleId: user?.roleId ?? '',
      branchId: user?.branchId ?? '',
      isCrossBranch: user?.isCrossBranch ?? false,
    })
  }, [open, reset, user])

  useEffect(() => {
    if (open && !user && options?.branches.length === 1 && !getValues('branchId')) {
      setValue('branchId', options.branches[0]!.id)
    }
  }, [open, user, options, getValues, setValue])

  useEffect(() => {
    if (selectedRole) {
      const roleRequiresGlobalAccess = selectedRole.isSystem === 1
      if (isCrossBranch !== roleRequiresGlobalAccess) {
        setValue('isCrossBranch', roleRequiresGlobalAccess, {
          shouldDirty: true,
          shouldValidate: true,
        })
      }
    }
  }, [isCrossBranch, selectedRole, setValue])

  const submit = handleSubmit(async (values) => {
    const payload: UserAccountValues = {
      name: values.name,
      email: values.email,
      roleId: values.roleId,
      branchId: values.branchId || null,
      isCrossBranch: values.isCrossBranch,
      ...(isEditing ? {} : { password: values.password }),
    }
    if (await onSave(user?.id ?? null, payload)) reset()
  })

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting) return
    onOpenChange(nextOpen)
    if (!nextOpen) reset()
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={isEditing ? 'Edit user account' : 'Create user account'}
      description={
        isEditing
          ? 'Update the account name, role, and branch access.'
          : 'Create an account with a secure initial password and least-privilege role.'
      }
      size="wide"
    >
      <form className="dialog-form" onSubmit={submit}>
        <div className="dialog-field-grid">
          <label className="field-label">
            <FieldHeading required>Name</FieldHeading>
            <input
              className="form-input"
              autoFocus
              aria-required="true"
              maxLength={180}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${formId}-name-error` : undefined}
              {...register('name', {
                required: 'Enter the user name.',
                validate: (value) => value.trim().length >= 2 || 'Use at least 2 characters.',
              })}
              placeholder="Full name"
            />
            {errors.name && (
              <span id={`${formId}-name-error`} className="field-error" role="alert">
                {errors.name.message}
              </span>
            )}
          </label>

          <label className="field-label">
            <FieldHeading required>Email</FieldHeading>
            <input
              className="form-input"
              type="email"
              aria-required="true"
              maxLength={254}
              disabled={isSubmitting || isEditing}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${formId}-email-error` : undefined}
              {...register('email', { required: 'Enter an email address.' })}
              placeholder="name@company.com"
            />
            {errors.email && (
              <span id={`${formId}-email-error`} className="field-error" role="alert">
                {errors.email.message}
              </span>
            )}
          </label>

          {!isEditing && (
            <label className="field-label">
              <FieldHeading required>Initial password</FieldHeading>
              <input
                className="form-input"
                type="password"
                aria-required="true"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={`${formId}-password-requirements${errors.password ? ` ${formId}-password-error` : ''}`}
                {...register('password', {
                  required: 'Set an initial password.',
                  validate: (value) => isStrongPassword(value) || 'Meet all password requirements.',
                })}
                placeholder="Create a strong password"
              />
              <PasswordRequirements id={`${formId}-password-requirements`} value={password ?? ''} />
              {errors.password && (
                <span id={`${formId}-password-error`} className="field-error" role="alert">
                  {errors.password.message}
                </span>
              )}
            </label>
          )}

          {!isEditing && (
            <label className="field-label">
              <FieldHeading required>Confirm initial password</FieldHeading>
              <input
                className="form-input"
                type="password"
                aria-required="true"
                autoComplete="new-password"
                maxLength={128}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby={errors.confirmPassword ? `${formId}-confirm-error` : undefined}
                {...register('confirmPassword', {
                  required: 'Confirm the initial password.',
                  validate: (value) => value === getValues('password') || 'Passwords do not match.',
                })}
              />
              {errors.confirmPassword && (
                <span id={`${formId}-confirm-error`} className="field-error" role="alert">
                  {errors.confirmPassword.message}
                </span>
              )}
            </label>
          )}

          <label className="field-label">
            <FieldHeading required>Role</FieldHeading>
            <Controller
              name="roleId"
              control={control}
              rules={{ required: 'Choose a role.' }}
              render={({ field }) => (
                <select
                  {...field}
                  className="form-input"
                  disabled={isSubmitting || isLoadingOptions || !options?.roles.length}
                  aria-required="true"
                  aria-invalid={Boolean(errors.roleId)}
                  aria-describedby={errors.roleId ? `${formId}-role-error` : undefined}
                >
                  <option value="">Select role</option>
                  {options?.roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.roleId && (
              <span id={`${formId}-role-error`} className="field-error" role="alert">
                {errors.roleId.message}
              </span>
            )}
            {selectedRole?.description && (
              <span className="form-helper">{selectedRole.description}</span>
            )}
          </label>

          <label className="field-label">
            <FieldHeading required={!isCrossBranch}>
              {isCrossBranch ? 'Home branch (optional)' : 'Branch'}
            </FieldHeading>
            <Controller
              name="branchId"
              control={control}
              rules={{
                validate: (value, formValues) =>
                  Boolean(value || formValues.isCrossBranch) || 'Choose a branch.',
              }}
              render={({ field }) => (
                <select
                  {...field}
                  className="form-input"
                  disabled={isSubmitting || isLoadingOptions || !options?.branches.length}
                  aria-required={!isCrossBranch}
                  aria-invalid={Boolean(errors.branchId)}
                  aria-describedby={errors.branchId ? `${formId}-branch-error` : undefined}
                >
                  <option value="">{isCrossBranch ? 'No home branch' : 'Select branch'}</option>
                  {options?.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.branchId && (
              <span id={`${formId}-branch-error`} className="field-error" role="alert">
                {errors.branchId.message}
              </span>
            )}
          </label>

          {selectedRole?.isSystem === 1 && (
            <p className="form-helper" role="status">
              Administrator accounts have company-wide branch access.
            </p>
          )}

          {isLoadingOptions && (
            <p className="form-helper" role="status">
              Loading roles and branches…
            </p>
          )}
          {optionsError && (
            <div role="alert" className="dialog-options-error">
              <strong>Could not load roles and branches.</strong>
              <span>{optionsError}</span>
              <button type="button" className="button button-outline" onClick={onRetryOptions}>
                Try again
              </button>
            </div>
          )}
          {!isLoadingOptions && options?.roles.length === 0 && (
            <p className="field-error">
              There are no roles you can assign. Ask an administrator to configure a role.
            </p>
          )}
        </div>

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
            disabled={
              isSubmitting || isLoadingOptions || Boolean(optionsError) || !options?.roles.length
            }
          >
            {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create account'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
