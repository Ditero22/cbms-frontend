import { useLayoutEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { DialogWorkflow, WorkflowContext, type Entry } from './dialog-workflow-store'

export function DialogWorkflowProvider({ children }: PropsWithChildren) {
  const [workflow] = useState(() => new DialogWorkflow())
  return (
    <WorkflowContext.Provider value={workflow}>
      {children}
      <DialogWorkflowHost workflow={workflow} />
    </WorkflowContext.Provider>
  )
}

function DialogBodySlot({ entry }: { entry: Entry }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    if (!slot) return
    slot.append(entry.body)
    return () => entry.body.remove()
  }, [slot, entry.body])
  return <div className="dialog-body-slot" ref={setSlot} />
}

function DialogWorkflowHost({ workflow }: { workflow: DialogWorkflow }) {
  const entry = useSyncExternalStore(workflow.subscribe, workflow.snapshot)
  if (!entry) return null
  return (
    <Dialog.Root
      key={`${entry.id}:${entry.discarding ? 'discard' : 'content'}`}
      open
      onOpenChange={(open) => !open && entry.close()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`dialog-content dialog-size-${entry.discarding ? 'sm' : entry.size}`}
          role={entry.discarding ? 'alertdialog' : 'dialog'}
          {...(!entry.discarding && !entry.description ? { 'aria-describedby': undefined } : {})}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            const root = event.currentTarget as HTMLElement
            const target =
              !entry.discarding && entry.focus?.isConnected
                ? entry.focus
                : (root.querySelector<HTMLElement>(
                    '.dialog-body input:not(:disabled):not([type="hidden"]), .dialog-body select:not(:disabled), .dialog-body textarea:not(:disabled)',
                  ) ??
                  root.querySelector<HTMLElement>('.dialog-body button:not(:disabled)') ??
                  root.querySelector<HTMLElement>('button:not(:disabled)'))
            ;(target ?? root).focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            // The next step restores its own focus. Only a completed workflow returns to the page.
            requestAnimationFrame(() => {
              if (!workflow.snapshot() && entry.origin?.isConnected) entry.origin.focus()
            })
          }}
        >
          <div className="dialog-heading">
            <div>
              <Dialog.Title className="dialog-title">
                {entry.discarding ? 'Discard changes?' : entry.title}
              </Dialog.Title>
              {(entry.discarding || entry.description) && (
                <Dialog.Description className="dialog-description">
                  {entry.discarding ? 'Your unsaved changes will be lost.' : entry.description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={18} />
            </Dialog.Close>
          </div>
          {entry.discarding ? (
            <div className="dialog-body">
              <div className="dialog-actions">
                <button className="button button-outline" type="button" onClick={entry.close}>
                  Keep editing
                </button>
                <button className="button button-danger" type="button" onClick={entry.discard}>
                  Discard
                </button>
              </div>
            </div>
          ) : (
            <DialogBodySlot entry={entry} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
