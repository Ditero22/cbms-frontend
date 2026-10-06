import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useDialogWorkflow } from './dialog-workflow-store'

const RequestCloseContext = createContext<() => void>(() => undefined)

export function DialogCancelButton({
  children = 'Cancel',
  className = 'button button-outline',
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const requestClose = useContext(RequestCloseContext)
  return (
    <button
      {...props}
      type="button"
      className={className}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) requestClose()
      }}
    >
      {children}
    </button>
  )
}

export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'sm',
  hasUnsavedChanges = false,
  error,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  hasUnsavedChanges?: boolean
  error?: string
  children: ReactNode
}) {
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false)
  const [formHasChanges, setFormHasChanges] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const initialFormSnapshot = useRef<string | null>(null)
  const formHasChangesRef = useRef(false)
  const id = useId()
  const workflow = useDialogWorkflow()
  const [body] = useState(() => document.createElement('div'))
  const step = {
    id,
    body,
    title,
    description,
    size,
    discarding: discardPromptOpen,
    close: () => (discardPromptOpen ? setDiscardPromptOpen(false) : requestClose()),
    discard: () => {
      setDiscardPromptOpen(false)
      onOpenChange(false)
    },
  }
  const stepRef = useRef(step)
  useLayoutEffect(() => {
    stepRef.current = step
    if (open) workflow.update(step)
  })
  useLayoutEffect(() => {
    if (!open) return
    workflow.open(stepRef.current)
    return () => workflow.close(id)
  }, [open, workflow, id])

  useEffect(() => {
    if (open) {
      setDiscardPromptOpen(false)
      setFormHasChanges(false)
      formHasChangesRef.current = false
      initialFormSnapshot.current = null
      const frame = requestAnimationFrame(() => {
        initialFormSnapshot.current = getFormSnapshot(contentRef.current)
      })
      return () => cancelAnimationFrame(frame)
    }
    initialFormSnapshot.current = null
    setDiscardPromptOpen(false)
    setFormHasChanges(false)
    formHasChangesRef.current = false
  }, [open])

  function updateFormDirtyState(event: SyntheticEvent) {
    const reconcile = () => {
      const initial = initialFormSnapshot.current
      if (initial === null) return
      const changed = getFormSnapshot(contentRef.current) !== initial
      formHasChangesRef.current = changed
      setFormHasChanges(changed)
    }
    if (event.type === 'click') requestAnimationFrame(reconcile)
    else reconcile()
  }

  function requestClose() {
    if (contentRef.current?.querySelector('[aria-busy="true"]')) return
    if (hasUnsavedChanges || formHasChangesRef.current || formHasChanges) {
      setDiscardPromptOpen(true)
      return
    }
    onOpenChange(false)
  }

  return open
    ? createPortal(
        <RequestCloseContext.Provider value={requestClose}>
          <div
            className="dialog-body"
            ref={contentRef}
            onInputCapture={updateFormDirtyState}
            onChangeCapture={updateFormDirtyState}
            onClickCapture={updateFormDirtyState}
          >
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            {children}
          </div>
        </RequestCloseContext.Provider>,
        body,
      )
    : null
}

function getFormSnapshot(root: HTMLElement | null) {
  if (!root) return ''
  return JSON.stringify(
    Array.from(
      root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'form.dialog-form input, form.dialog-form select, form.dialog-form textarea',
      ),
    )
      .filter((control) => !control.closest('[data-dialog-ignore-dirty]'))
      .map((control, index) => ({
        key: control.name || control.id || `control-${index}`,
        type: control instanceof HTMLInputElement ? control.type : control.tagName,
        value:
          control instanceof HTMLInputElement &&
          (control.type === 'checkbox' || control.type === 'radio')
            ? control.checked
            : control instanceof HTMLInputElement && control.type === 'file'
              ? Array.from(control.files ?? []).map((file) => `${file.name}:${file.size}`)
              : control.value,
      })),
  )
}
