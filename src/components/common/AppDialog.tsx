import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
} from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

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
  size = 'standard',
  hasUnsavedChanges = false,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  size?: 'standard' | 'wide'
  hasUnsavedChanges?: boolean
  children: ReactNode
}) {
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false)
  const [formHasChanges, setFormHasChanges] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const initialFormSnapshot = useRef<string | null>(null)
  const formHasChangesRef = useRef(false)
  const returnFocus = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  )

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
    const rememberFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) returnFocus.current = event.target
    }
    document.addEventListener('focusin', rememberFocus)
    return () => document.removeEventListener('focusin', rememberFocus)
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

  return (
    <>
      <Dialog.Root
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) onOpenChange(true)
          else if (contentRef.current?.querySelector('[aria-busy="true"]')) return
          else if (discardPromptOpen) setDiscardPromptOpen(false)
          else requestClose()
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className={`dialog-content${size === 'wide' ? ' dialog-wide' : ''}`}
            onOpenAutoFocus={(event) => {
              const focused = document.activeElement
              if (
                focused instanceof HTMLElement &&
                event.currentTarget instanceof HTMLElement &&
                !event.currentTarget.contains(focused)
              ) {
                returnFocus.current = focused
              }
            }}
            onCloseAutoFocus={(event) => {
              if (returnFocus.current?.isConnected) {
                event.preventDefault()
                returnFocus.current.focus()
              }
            }}
          >
            <div className="dialog-heading">
              <div>
                <Dialog.Title className="dialog-title">{title}</Dialog.Title>
                {description && (
                  <Dialog.Description className="dialog-description">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close className="icon-button" aria-label="Close dialog">
                <X size={18} />
              </Dialog.Close>
            </div>
            <RequestCloseContext.Provider value={requestClose}>
              <div
                className="dialog-body"
                ref={contentRef}
                onInputCapture={updateFormDirtyState}
                onChangeCapture={updateFormDirtyState}
                onClickCapture={updateFormDirtyState}
              >
                {children}
              </div>
            </RequestCloseContext.Provider>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={discardPromptOpen} onOpenChange={setDiscardPromptOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            role="alertdialog"
            aria-describedby="dialog-discard-description"
            className="dialog-content dialog-discard-confirmation"
            onEscapeKeyDown={(event) => {
              event.preventDefault()
              setDiscardPromptOpen(false)
            }}
          >
            <Dialog.Title className="dialog-title">Discard changes?</Dialog.Title>
            <Dialog.Description id="dialog-discard-description" className="dialog-description">
              Your unsaved changes will be lost.
            </Dialog.Description>
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button type="button" className="button button-outline">
                  Keep editing
                </button>
              </Dialog.Close>
              <button
                type="button"
                className="button button-danger"
                onClick={() => {
                  setDiscardPromptOpen(false)
                  onOpenChange(false)
                }}
              >
                Discard
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
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
