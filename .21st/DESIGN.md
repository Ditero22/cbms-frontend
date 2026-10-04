# Materials Supply Operations & Finance frontend design context

Generated locally by 21st CLI 1.17.1, then corrected against actual source. The detector missed custom shared components and classified text color tokens as typography. `design.json` records those corrections; source files remain authoritative.

- Product: local materials supplier and reseller operations and finance app, named **Materials Supply Operations & Finance**.
- Stack: React 19, TypeScript, Vite, Tailwind 3, custom CSS tokens, Radix dialogs, React Query, React Hook Form, Lucide icons.
- Identity: approved product name with the existing blue/orange palette; light and dark themes; DM Sans typography; compact readable business records.
- Tokens: `src/index.css` root values and dark overrides. Preserve semantic danger/status tokens and visible focus states. Use secondary text for essential help/metadata.
- Shell: AppShell, Sidebar, NavigationLinks, Topbar, MobileDrawer. Actual branch scope is read-only; switching is not a supported workflow.
- Shared primitives: PageHeading, Breadcrumbs, DataTable/StatusBadge/mobile cards, AppDialog, FieldHeading, FormField, FormOptionsState, RecordHistoryPanel, RecordPagination, AttachmentList, ProofUploader.
- Owners: Users, Fleet, Driver Allowances, Customer Payments, Inventory, Expenses; other modules share transitional ModulePage.
- Rules: reuse primitives, exact decimal helpers and actual API records; one page primary create action; show practical record information directly; preserve grants and business behavior; test all requested widths and meaningful failure/retry/keyboard states.
- Avoid: extra brand names/acronyms, new palette, decorative controls, fake features, invented payroll/transfer policy, unnecessary component libraries and marketing layouts.

Sources: [frontend architecture](../FRONTEND_ARCHITECTURE.md), [current progress](../../md-docs/project/progressreport.md), [approved scope](../../md-docs/project/release-scope.md), and [historical UI audit](../../md-docs/archive/audits/ui-ux-2026-10-01.md). Code paths are relative to the frontend package root: src/components/common, src/components/layout, src/features, src/index.css, src/styles/responsive.css.

21st review runs locally. Catalog search currently requires unavailable login/API credentials; no hosted generation or active MCP connection is claimed.
