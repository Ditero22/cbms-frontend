import { FieldHeading } from '@/components/common/FieldHeading'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { PasswordRequirements } from '@/features/users/PasswordRequirements'
import { isStrongPassword } from '@/features/users/password-policy'

type ResetPasswordValues = { password: string; confirmPassword: string }

type ResetUserPasswordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userName: string
  onSave: (password: string) => Promise<boolean>
  submitError?: string
}

export function ResetUserPasswordDialog({
  open,
  onOpenChange,
  userName,
  onSave,
  submitError,
}: ResetUserPasswordDialogProps) {
  const formId = useId()
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ defaultValues: { password: '', confirmPassword: '' } })
  const password = watch('password')

  const submit = handleSubmit(async ({ password }) => {
    if (await onSave(password)) reset()
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
      title="Reset user password"
      description={`Set a new password for ${userName}. All of their active sessions will end.`}
    >
      <form className="dialog-form" onSubmit={submit}>
        <label className="field-label">
          <FieldHeading required>New password</FieldHeading>
          <input
            className="form-input"
            type="password"
            aria-required="true"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={`${formId}-password-requirements${errors.password ? ` ${formId}-password-error` : ''}`}
            {...register('password', {
              required: 'Enter a new password.',
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

        <label className="field-label">
          <FieldHeading required>Confirm new password</FieldHeading>
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
              required: 'Confirm the new password.',
              validate: (value) => value === getValues('password') || 'Passwords do not match.',
            })}
          />
          {errors.confirmPassword && (
            <span className="field-error" id={`${formId}-confirm-error`} role="alert">
              {errors.confirmPassword.message}
            </span>
          )}
        </label>

        {submitError && (
          <p className="field-error" role="alert">
            {submitError}
          </p>
        )}
        <div className="dialog-actions">
          <DialogCancelButton disabled={isSubmitting} />
          <button type="submit" className="button button-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Resetting…' : 'Reset password'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
