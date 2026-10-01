import { FormField } from '@/components/common/FormField'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { AppDialog } from '@/components/common/AppDialog'
import { apiRequest } from '@/services/api/client'
import type { ModuleDefinition } from './modules'
import { createFieldsByModule, validateCreateField, type CreateField } from './create-fields'
import type { CreateRecordValues } from './types'

type CreateRecordDialogProps = {
  module: ModuleDefinition
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (values: CreateRecordValues) => Promise<boolean>
  record?: Record<string, unknown> | null
  onSave?: (id: string, values: CreateRecordValues) => Promise<boolean>
  saveError?: string
  isCrossBranch?: boolean
}

export function CreateRecordDialog({
  module,
  open,
  onOpenChange,
  onCreate,
  record,
  onSave,
  saveError,
  isCrossBranch = false,
}: CreateRecordDialogProps) {
  const recordId = typeof record?.id === 'string' ? record.id : null
  const isEditing = Boolean(recordId)
  const recordName = module.addLabel.replace(/^(Add|Create) /, '').toLowerCase()
  const productOptionsQuery = useQuery({
    queryKey: ['product-form-options'],
    queryFn: () => apiRequest<{ suppliers: { id: string; name: string }[] }>('/products/options'),
    enabled: open && module.id === 'products',
  })
  const customerBranchOptionsQuery = useQuery<{
    branches: { id: string; name: string }[]
  }>({
    queryKey: ['customer-create-branch-options'],
    queryFn: () => apiRequest<{ branches: { id: string; name: string }[] }>('/customers/options'),
    enabled: open && !isEditing && module.id === 'customers' && isCrossBranch,
  })
  const customerBranches = customerBranchOptionsQuery.data?.branches ?? []
  const fields = getCreateFields(
    module.id,
    productOptionsQuery.data,
    record,
    customerBranches,
    isCrossBranch,
  )
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateRecordValues>({ defaultValues: {} })

  useEffect(() => {
    if (!open) return
    const editableFields = [
      ...(createFieldsByModule[module.id] ?? []),
      ...(!isEditing && module.id === 'customers' && isCrossBranch ? [{ name: 'branchId' }] : []),
      ...(isEditing ? [{ name: 'status' }] : []),
    ]
    reset(
      Object.fromEntries(
        editableFields.map((field) => [
          field.name,
          record ? getRecordFieldValue(record, field.name) : '',
        ]),
      ),
    )
  }, [isCrossBranch, isEditing, module.id, open, record, reset])

  const submit = handleSubmit(async (values) => {
    if (isEditing && recordId) {
      if (!onSave || !record) return
      const changedValues = Object.fromEntries(
        Object.entries(values).filter(
          ([name, value]) => value !== getRecordFieldValue(record, name),
        ),
      )
      if (Object.keys(changedValues).length === 0 || (await onSave(recordId, changedValues))) {
        onOpenChange(false)
        reset()
      }
      return
    }

    const createValues = Object.fromEntries(
      Object.entries(values).filter(([name, value]) => {
        const field = fields.find((candidate) => candidate.name === name)
        return field?.required || value !== ''
      }),
    )
    if (await onCreate(createValues)) {
      onOpenChange(false)
      reset()
    }
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
      title={isEditing ? `Edit ${recordName}` : module.addLabel}
      description={
        isEditing ? 'Update the stored record details.' : `Create a ${recordName} record in CBMS.`
      }
      size="wide"
    >
      <form className="dialog-form" onSubmit={submit} aria-busy={isSubmitting}>
        {fields.length === 0 ? (
          <p>Record {isEditing ? 'editing' : 'creation'} is not available for this module yet.</p>
        ) : (
          <div className="create-record-fields">
            {fields.map((field, index) => (
              <FormField
                key={field.name}
                label={field.label}
                required={field.required}
                error={errors[field.name] ? String(errors[field.name]?.message) : undefined}
                hint={field.hint}
              >
                {(attributes) =>
                  field.type === 'select' ? (
                    <select
                      {...attributes}
                      className="form-input"
                      autoFocus={index === 0}
                      disabled={
                        isSubmitting ||
                        (field.name === 'supplierId' &&
                          (productOptionsQuery.isPending || productOptionsQuery.isError) &&
                          !record?.supplierId)
                      }
                      {...register(field.name, {
                        required: field.required ? `${field.label} is required.` : false,
                        setValueAs: (value: string) => value.trim(),
                        validate: (value) => validateCreateField(field, value),
                      })}
                    >
                      <option value="">
                        {field.name === 'supplierId'
                          ? 'No supplier'
                          : module.id === 'customers' && field.name === 'branchId'
                            ? 'Unassigned'
                            : `Select ${field.label.toLowerCase()}`}
                      </option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      {...attributes}
                      className="form-input"
                      rows={3}
                      disabled={isSubmitting}
                      maxLength={field.maxLength}
                      autoFocus={index === 0}
                      {...register(field.name, {
                        required: field.required ? `${field.label} is required.` : false,
                        setValueAs: (value: string) => value.trim(),
                        validate: (value) => validateCreateField(field, value),
                      })}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  ) : (
                    <input
                      {...attributes}
                      className="form-input"
                      type={field.type ?? 'text'}
                      disabled={isSubmitting}
                      step={field.type === 'number' ? getNumberStep(field.name) : undefined}
                      min={
                        field.name === 'unitPrice' ? 0 : field.name === 'amount' ? 0.01 : undefined
                      }
                      maxLength={field.maxLength}
                      autoFocus={index === 0}
                      {...register(field.name, {
                        required: field.required ? `${field.label} is required.` : false,
                        setValueAs: (value: string) => value.trim(),
                        validate: (value) => validateCreateField(field, value),
                      })}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  )
                }
              </FormField>
            ))}
          </div>
        )}
        {module.id === 'products' && productOptionsQuery.isPending && (
          <p className="form-helper">Loading active suppliers…</p>
        )}
        {module.id === 'products' && productOptionsQuery.isError && (
          <p className="field-error" role="alert">
            Supplier choices could not be loaded. You can still save without changing the supplier.{' '}
            <button
              type="button"
              className="button button-quiet button-small"
              onClick={() => void productOptionsQuery.refetch()}
            >
              Try again
            </button>
          </p>
        )}
        {module.id === 'customers' &&
          !isEditing &&
          isCrossBranch &&
          customerBranchOptionsQuery.isPending && (
            <p className="form-helper" role="status">
              Loading active branches…
            </p>
          )}
        {module.id === 'customers' &&
          !isEditing &&
          isCrossBranch &&
          customerBranchOptionsQuery.isError && (
            <p className="field-error" role="alert">
              Branch choices could not be loaded. You can still create an unassigned customer.{' '}
              <button
                type="button"
                className="button button-quiet button-small"
                onClick={() => void customerBranchOptionsQuery.refetch()}
              >
                Try again
              </button>
            </p>
          )}
        {module.id === 'customers' &&
          !isEditing &&
          isCrossBranch &&
          customerBranchOptionsQuery.isSuccess &&
          customerBranches.length === 0 && (
            <p className="form-helper">
              No active branches are available. This customer can remain unassigned.
            </p>
          )}
        {saveError && (
          <p className="field-error" role="alert">
            {saveError}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-outline"
            disabled={isSubmitting}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={isSubmitting || fields.length === 0 || (isEditing && !onSave)}
          >
            {!isEditing && <Plus size={16} />}
            {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create record'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}

function getCreateFields(
  moduleId: string,
  productOptions?: { suppliers: { id: string; name: string }[] },
  record?: Record<string, unknown> | null,
  customerBranches: { id: string; name: string }[] = [],
  isCrossBranch = false,
): CreateField[] {
  const statusField: CreateField[] = record?.id
    ? [
        {
          name: 'status',
          label: 'Status',
          required: true,
          type: 'select',
          options: [
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' },
          ],
        },
      ]
    : []

  if (moduleId === 'products') {
    const supplierId = typeof record?.supplierId === 'string' ? record.supplierId : ''
    const supplierOptions =
      productOptions?.suppliers.map((supplier) => ({
        value: supplier.id,
        label: supplier.name,
      })) ?? []
    if (supplierId && !supplierOptions.some((supplier) => supplier.value === supplierId)) {
      const supplierName =
        typeof record?.supplierName === 'string' ? record.supplierName : 'Current supplier'
      supplierOptions.unshift({ value: supplierId, label: `${supplierName} (inactive)` })
    }
    return [
      ...createFieldsByModule.products.map((field) =>
        field.name === 'supplierId' ? { ...field, options: supplierOptions } : field,
      ),
      ...statusField,
    ]
  }

  if (moduleId === 'customers' && !record && isCrossBranch) {
    return [
      ...(createFieldsByModule.customers ?? []),
      {
        name: 'branchId',
        label: 'Branch',
        required: false,
        hint: 'Optional. Unassigned customers are visible only to Admin accounts.',
        type: 'select',
        options: customerBranches.map((branch) => ({ value: branch.id, label: branch.name })),
      },
    ]
  }

  return [...(createFieldsByModule[moduleId] ?? []), ...statusField]
}

function getNumberStep(fieldName: string) {
  return fieldName === 'quantityDelta' || fieldName === 'quantity' ? '0.001' : '0.01'
}

function getRecordFieldValue(record: Record<string, unknown>, fieldName: string): string {
  const value = record[fieldName]
  if (value === null || value === undefined) return ''
  return String(value)
}
