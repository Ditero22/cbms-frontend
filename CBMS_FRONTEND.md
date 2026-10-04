# Materials Supply Operations & Finance frontend product constraints

This is a short product and interaction reference, not a framework tutorial or a claim that every listed feature is complete. For current structure, state flow, and reusable components, use [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) and inspect the affected source. The [release scope](../md-docs/project/release-scope.md) and [business decisions](../md-docs/business/decisions.md) own business policy.

## Product identity and authority

- The user-approved product name is **Materials Supply Operations & Finance**. The app supports a local materials supplier and reseller with stock, orders, delivery, workers, expenses, and financial records. Do not describe it as a general construction-project management system or present CBMS/MSMS as the product name.
- Preserve the existing color system and dark-theme direction while applying the approved product name. Use the tokens and primitives already implemented in `src`; do not add a second design system from an old mockup.
- The app is an authenticated business-management frontend. The backend owns authentication, validation, business rules, data integrity, permissions, and branch scope. Frontend guards only guide the interface.
- A route, control, or design reference does not prove a feature is functional. Follow existing API paths and tests; do not add placeholder controls or invent behavior to fill a screen.

## Consistent interaction rules

- Reuse the shared shell, page patterns, form fields, dialogs, data views, feedback states, and existing primitives before adding another component. Add an abstraction only when it has a clear owner and repeated use.
- Give each operation one clear primary action per page or workflow. Avoid duplicate buttons that trigger the same action; place less-frequent actions in the established secondary/action-menu pattern.
- Use controls that fit the data: select/combobox for choices, radio groups for exclusive options, switches for immediate binary preferences, checkboxes for independent selections, date controls for dates, bounded numeric/currency inputs for quantities and money, and textareas only for genuinely longer notes.
- Keep forms compact and grouped by task. Preserve drafts on recoverable errors, show field and server validation, guard duplicate submissions, and make pending, success, empty, and failure states understandable.
- Lists must preserve essential record information and actions at narrow widths. Use the existing mobile record/card pattern when a table cannot remain readable; do not squeeze desktop columns into a phone viewport.
- Keep keyboard access, visible focus, labels, error associations, sufficient contrast, and responsive behavior when extending shared UI.

## Scope-sensitive flows

- Payroll is manual for the approved first release. Driver Allowance is separate trip-related settlement/history and must not be silently merged or removed.
- Inventory transfers post immediately and atomically under the approved first-release rule.
- Delivery proof is optional. If provided, it remains private and server-authorized.
- Unassigned legacy customers remain Admin-only; branch users use customers assigned to their branch.
- These rules are summarized here only to route UI work. The linked decision/security registers remain authoritative.

## Source of truth

Routes, permissions displayed in navigation, actual component APIs, design tokens, breakpoints, API calls, and live behavior are defined by `src/` and verified tests. Architecture notes are guidance for locating code, not permission to rewrite unrelated modules. Check the relevant feature and shared component before changing a page pattern.
