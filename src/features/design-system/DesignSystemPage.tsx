import { Check, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { PageHeading } from '@/components/common/PageHeading'
export function DesignSystemPage() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <PageHeading
        eyebrow="FOUNDATIONS"
        title="Design system"
        description="A shared visual language for clear, confident day-to-day operations."
      >
        <button
          className="button button-outline"
          onClick={async () => {
            await navigator.clipboard?.writeText(
              'Primary #253C6D · Accent #F2842F · Neutral #F2F2F2',
            )
            toast.success('Design tokens copied to clipboard.')
          }}
        >
          Copy tokens
        </button>
      </PageHeading>
      <section className="design-section">
        <div className="section-title">
          <div>
            <h2>Brand palette</h2>
            <p>Core app colors and semantic status colors.</p>
          </div>
          <span className="section-note">v1.0 · SEPT 2026</span>
        </div>
        <div className="swatch-grid">
          {[
            { name: 'Primary blue', code: '#253C6D', className: 'swatch-navy' },
            {
              name: 'Supplier orange',
              code: '#F2842F',
              className: 'swatch-orange',
            },
            {
              name: 'Light neutral',
              code: '#F2F2F2',
              className: 'swatch-neutral',
            },
            { name: 'Success', code: '#16803A', className: 'swatch-success' },
            { name: 'Warning', code: '#D97706', className: 'swatch-warning' },
            { name: 'Danger', code: '#DC2626', className: 'swatch-danger' },
          ].map((token) => (
            <button
              key={token.name}
              className="swatch-card"
              onClick={() => {
                navigator.clipboard?.writeText(token.code)
                toast.success(`${token.code} copied.`)
              }}
            >
              <span className={`swatch-color ${token.className}`} />
              <span>
                <strong>{token.name}</strong>
                <small>{token.code}</small>
              </span>
              <span className="swatch-copy">
                <Check size={14} />
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="design-section">
        <div className="section-title">
          <div>
            <h2>Buttons & controls</h2>
            <p>Consistent actions, fields, and status indicators.</p>
          </div>
        </div>
        <div className="component-showcase">
          <div className="showcase-block">
            <span className="showcase-label">BUTTON VARIANTS</span>
            <div className="showcase-row">
              <button className="button button-primary">
                <Plus size={16} />
                Primary action
              </button>
              <button className="button button-outline">Secondary</button>
              <button className="button button-quiet">Quiet action</button>
              <button className="button button-danger">Destructive</button>
            </div>
          </div>
          <div className="showcase-block">
            <span className="showcase-label">INPUTS & STATES</span>
            <div className="showcase-row">
              <input className="form-input showcase-input" placeholder="Default text input" />
              <input className="form-input showcase-input" placeholder="Search records..." />
              <span className="status-badge good">
                <i />
                Approved
              </span>
              <span className="status-badge warning">
                <i />
                Pending
              </span>
              <span className="status-badge danger">
                <i />
                Rejected
              </span>
            </div>
          </div>
          <div className="showcase-block">
            <span className="showcase-label">LIGHT & DARK MODE</span>
            <p className="theme-explainer">
              Use the sun/moon control in the top bar. Components use the same semantic tokens in
              either theme.
            </p>
          </div>
          <div className="showcase-block">
            <span className="showcase-label">DIALOG PREVIEW</span>
            <button className="button button-outline" onClick={() => setOpen(true)}>
              Open example dialog
            </button>
          </div>
        </div>
      </section>
      <section className="design-section">
        <div className="section-title">
          <div>
            <h2>Type scale</h2>
            <p>Manrope headings and DM Sans interface text.</p>
          </div>
        </div>
        <div className="type-showcase">
          <span className="type-overline">PAGE EYEBROW · 11 / 700</span>
          <h1>Operations overview</h1>
          <h2>Section heading</h2>
          <p>
            Body copy designed for comfortable reading across daily workflows and data dense
            screens.
          </p>
          <small>Secondary text · labels · helpful hints</small>
        </div>
      </section>
      <AppDialog
        open={open}
        onOpenChange={setOpen}
        title="Confirm stock adjustment"
        description="This action changes the recorded on-hand quantity for this branch."
      >
        <div className="detail-list">
          <div>
            <span>Product</span>
            <strong>Deformed Bar 10mm</strong>
          </div>
          <div>
            <span>New quantity</span>
            <strong>58 pcs</strong>
          </div>
        </div>
        <div className="dialog-actions">
          <DialogCancelButton />
          <button
            className="button button-primary"
            onClick={() => {
              setOpen(false)
              toast.success('Example confirmation complete.')
            }}
          >
            Confirm adjustment
          </button>
        </div>
      </AppDialog>
    </>
  )
}
import { useState } from 'react'
