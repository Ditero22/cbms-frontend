import { createContext, useContext } from 'react'
export type DialogStep = {
  id: string
  body: HTMLDivElement
  title: string
  description?: string
  size: 'sm' | 'md' | 'lg' | 'xl'
  discarding: boolean
  close: () => void
  discard: () => void
}

export type Entry = DialogStep & { origin: HTMLElement | null; focus: HTMLElement | null }

/** One visible Radix surface; suspended bodies retain their React and native input state. */
export class DialogWorkflow {
  private entries: Entry[] = []
  private listeners = new Set<() => void>()
  private active: Entry | null = null
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  snapshot = () => this.active
  private publish() {
    this.active = this.entries.at(-1) ?? null
    this.listeners.forEach((listener) => listener())
  }
  open(step: DialogStep) {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (this.active && focused && this.active.body.contains(focused)) this.active.focus = focused
    this.entries.push({ ...step, origin: focused, focus: null })
    this.publish()
  }
  update(step: DialogStep) {
    const index = this.entries.findIndex((entry) => entry.id === step.id)
    if (index < 0) return
    const entry = this.entries[index]
    if (!entry.discarding && step.discarding) {
      const focused = document.activeElement
      if (focused instanceof HTMLElement && entry.body.contains(focused)) entry.focus = focused
    }
    this.entries[index] = { ...entry, ...step }
    this.publish()
  }
  close(id: string) {
    const closing = this.entries.find((entry) => entry.id === id)
    if (closing) {
      for (const entry of this.entries) {
        if (entry.origin && closing.body.contains(entry.origin)) entry.origin = closing.origin
      }
    }
    this.entries = this.entries.filter((entry) => entry.id !== id)
    this.publish()
  }
}

export const WorkflowContext = createContext<DialogWorkflow | null>(null)

export function useDialogWorkflow() {
  const workflow = useContext(WorkflowContext)
  if (!workflow) throw new Error('AppDialog requires DialogWorkflowProvider.')
  return workflow
}
