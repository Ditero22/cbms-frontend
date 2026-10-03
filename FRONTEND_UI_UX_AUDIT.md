# CBMS Frontend UI/UX and Architecture Audit

> Shared documentation: [index](../md-docs/README.md), [current production progress](../md-docs/project/progressreport.md), and [approved release scope](../md-docs/project/release-scope.md). This package guide retains product/architecture details and dated checkpoints. Older “current” counts, follow-up tasks and scope assertions yield to those canonical sources; a documented feature is not proof of completion.


**Audit date:** 2026-09-30; evidence updated 2026-10-01.  
**Scope:** `cbms-frontend/src`, frontend configuration and architecture/design documentation, and the frontend API boundary.  
**Status:** Shared shell/list/dialog cleanup and domain-owned Users & Roles administration are implemented. Orders and Users & Roles have seven-width and core workflow acceptance; comprehensive other-module and accessibility regression remains.

> This file preserves the initial 2026-09-30 source findings as a historical baseline. Later 2026-10-01 shared changes and installation evidence are retained in the [historical project UI audit](../md-docs/archive/audits/ui-ux-2026-10-01.md). Read the [current progress report](../md-docs/project/progressreport.md) and [approved scope](../md-docs/project/release-scope.md) before treating earlier findings as open requirements.

## Executive assessment

The application has a workable React, TypeScript, React Router, and TanStack Query foundation, and the business API remains centralized behind a credentialed Fetch client. The first cleanup pass separates the desktop rail from the Radix mobile drawer, centralizes page breadcrumbs and heading rules, removes duplicate create actions, unifies the record list state across table and mobile-card presentations, and groups responsive rules in `src/styles/responsive.css`. Business API contracts and permission checks were preserved.

The implementation uses permission-gated navigation/queries, React Hook Form, native controls backed by API choices, Radix Dialog, and shared page/list patterns. It uses named CSS and a custom table rather than the shadcn foundation described in the product specification. `@tanstack/react-table` remains unused. Playwright now covers core order and administration workflows plus the shell; comprehensive component/accessibility and remaining-module coverage remains absent.

The numbered findings below record the baseline audit and should be read with the implementation status at the end of this document; several findings have since been addressed.

## Refactor work completed

- Replaced the desktop sidebar-as-drawer pattern with a dedicated Radix mobile drawer. The desktop sidebar is independently rendered; the drawer has a user/role header, its own scrollable navigation region, a fixed sign-out footer, and an accessible close control. Shared permission-filtered links prevent desktop/mobile navigation drift.
- Kept the existing 72px collapsed rail, added a stronger active/hover/focus treatment, and added a custom tooltip rendered outside the scroll container so it is not clipped. The aligned subtle scrollbar and content gutter remain intact.
- Removed the static help card, repeated sidebar profile popover, profile/settings placeholder actions, and button-like styling from the read-only branch scope. Account identity and sign-out appear in the desktop profile disclosure or the mobile drawer, according to viewport.
- Simplified the responsive top bar to a menu, current-page title, and theme action on phones. The desktop collapse control and account disclosure remain desktop-only; page headings provide the page action hierarchy.
- Added shared semantic breadcrumbs and removed the automatic current-date suffix from every `PageHeading`. The dashboard retains its date once in its own eyebrow.
- Traced module creation actions to `openCreateDialog`: removed its duplicate from the table toolbar and retained one permission-gated header action. Kept Dashboard → New order and Users → Manage roles because they initiate distinct flows. Unsupported create actions are hidden; the nonfunctional “Read only” button was removed.
- Removed the duplicate/fake module summary count and “Updated just now” metadata. Renamed the row details affordance to “View details” and removed the synthesized `Active` state from card display.
- Unified table and mobile cards inside `DataTable`. Mobile cards are automatic below 800px and share search, status filter, server sorting, export, empty state, and pagination with the desktop table. A native sort control preserves sorting when column headers are not visible.
- Renamed the general-purpose `ConfirmDialog` wrapper to `AppDialog`, added standard/wide sizes, improved long-form desktop layout and phone bottom-sheet behavior, and made role deletion hide the editor while the confirmation is open.
- Removed decorative dashboard sparklines and repeated “Live data” KPI labels, consolidated dashboard query failures into one retry state, and removed a misleading priority-task footer action. Dashboard recent orders and report results use card layouts at narrow widths; dashboard navigation shortcuts are permission-gated.
- Exposed the saved theme on `document.documentElement` as well as the app shell so modal portals inherit the selected dark surface and text tokens.
- Centralized status meaning in `utils/statusTone.ts`, fixing mismatched table/dashboard colors and preventing values such as “Inactive” or “Unavailable” from being classified as positive by substring matching.
- Moved responsive rules from the end of the global stylesheet into `src/styles/responsive.css`, imported after base tokens and component styles.

## Verification and remaining QA

- Frontend `typecheck`, `lint`, `format:check`, and production `build` pass. Build output contains only the existing upstream Rollup annotation warnings from Zod.
- Standalone Playwright with installed Chrome now passes 20 checks: 17 rendered scenarios and 3 exact-arithmetic checks. Order/shell/form screenshots and interactions cover 375/390/430/768/1024/1280/1440; core workflows run on desktop and phone. Drawer navigation/focus/scroll locking, collapsed tooltips, modal bounds/focus, one Orders create action, and workflow loading/error/retry/empty/read-only states are checked. Other page viewport coverage remains.
- Full interaction regression is still required for login/logout, role create/edit/delete, all module create forms, search/status/sorting/pagination, export, theme preference, permission variations, loading/error/empty states, and tablet/mobile drawer focus/scroll behavior.
- `ModulePage` still coordinates many workflow mutations and dialogs. Keep extracting only where a focused feature boundary reduces coupling without changing endpoint payloads or business rules.

## 1. Current architecture

- `src/main.tsx` loads global CSS and mounts `AppProviders` and `App`.
- `AppProviders` owns one TanStack Query client and the Sonner toaster.
- `App` resolves the session before rendering login or the authenticated `AppShell`, then maps one-segment business routes to the shared `ModulePage`.
- `AppShell` owns theme, sidebar collapse, mobile drawer, and profile-popover state. `ModuleRuntimeProvider` makes the user scope and shared create-record mutation available to module pages.
- Remote data belongs to TanStack Query. API endpoint functions live mostly together in `features/modules/modules.api.ts`, with transport and cookies centralized in `services/api/client.ts`. `ModulePage` still owns many workflow mutations and their invalidation/toast behavior.
- Local feature state is mostly in the correct page or form, but `ModulePage` has 851 lines of mixed list, detail, permission, workflow, and dialog state/rendering.

## 2. Layout components

- `AppShell` renders `Sidebar`, `Topbar`, and a raw `.page-content` wrapper around `Outlet`. There is no shared `PageContainer` or route-level layout state component.
- `PageHeading` is shared, but each page supplies its own breadcrumb markup or relies on the top-bar route crumb. The top bar, breadcrumb row, eyebrow, and heading can repeat the same section and title.
- `PageHeading` unconditionally appends the current date. `DashboardPage` also passes a full current-date string as its eyebrow, so the dashboard shows the date twice. Module and report headers also receive a date even when it adds no useful context.
- Header action placement is reasonably consistent on desktop, but the table adds its own create action and mobile page actions are forced to equal flex widths regardless of their primary/secondary importance.

## 3. Sidebar implementation

- `Sidebar.tsx` contains branding, permission-filtered navigation, the drawer close button, the mobile focus trap, and the help/profile footer.
- The duplicate `BuildCore Inc. / Construction group` card has already been removed. The scrollbar now has a shared gutter for expanded/collapsed widths, custom WebKit styling, and a Firefox thin-scrollbar color.
- Navigation groups come from module metadata, but “Design system” is presented as a user-facing “Preferences” route despite not being application settings. There is no actual settings route in the current router.
- The “Need a hand? Visit the help center” block is static markup with an external-link icon; it has no link or click behavior.
- A profile area is rendered in the sidebar markup but hidden for desktop; it is then enabled by responsive CSS for the drawer. This adds hidden duplicate account UI to the desktop tree.

## 4. Navbar implementation

- `Topbar.tsx` derives the route title from the URL, shows a “Workspace / title” crumb, branch scope, theme toggle, and profile button.
- The page title and module breadcrumbs are also rendered below it, creating repeated navigation context.
- `.branch-select` looks and hovers like an interactive selector, but is a `div` with no menu, click handler, or branch-options data. In the current frontend contract it is branch-scope text, not a selector; it should remain clearly informational until a branch-switch flow and authorized options exist.
- The navbar’s mobile version hides profile, truncates the current route label and branch name, and has no brand mark or wordmark to orient users.
- The theme toggle and persisted `cbms-theme` preference work. The collapsed-sidebar preference is also persisted. Neither preference currently has cross-tab synchronization.

## 5. Mobile drawer implementation

- The same `<aside className="sidebar">` is transformed into an off-canvas panel below 900px. Its width, header, nav, footer, and desktop collapsed-state rules are overridden in multiple media blocks rather than represented as a distinct mobile layout.
- Focus trapping, Escape handling, body scroll locking, focus restoration, backdrop close, route-click close, and `inert` background behavior are implemented manually across `Sidebar`, `Topbar`, and `AppShell`. The behaviors are useful but distributed and easy to regress.
- Drawer contents preserve desktop-specific branding and the help/profile footer. The profile menu opens upward from the bottom edge on mobile, which is cramped and can overlap navigation.
- The drawer does not close on browser-history navigation, only on its own links, Escape, or backdrop.
- The previous scrollbar edge/gutter change applies to this drawer as well; scrolling is independent, but the overall drawer composition is still desktop-derived.

## 6. Reusable components

- Existing reuse: `PageHeading`, `DataTable`, `ConfirmDialog`, `StatusInline`, `UserProfileMenu`, and dashboard panels.
- Native select, date, number, password, textarea, and checkbox controls are already used where the form model exposes those concepts. Forms use React Hook Form; validation is mostly inline rules rather than Zod except login.
- Radix Dialog and Sonner are present and useful. Lucide is used consistently for most iconography.
- There is no shared `components/ui` primitive layer, no shared field/help/error component, no stable status-tone mapper, and no common empty/error/loading state component.
- `StatusBadge` is defined inside `DataTable.tsx`, while `StatusInline` separately implements its own status classification. This is a duplicated component concern and causes different visual/tone rules.

## 7. Duplicate components and patterns

- `ConfirmDialog` is actually a general-purpose Radix modal frame used for forms, details, role management, previews, and confirmations. Its name implies destructive/confirm behavior that it does not enforce.
- Breadcrumb markup is independently authored in module and report pages, while the shell also shows a route crumb.
- `DataTable` and `ModulePage` both expose the create action. `ModulePage` also implements a separate grid/card listing and separate pagination from the table, duplicating list states and behavior.
- Dashboard panels and generic module/report pages each implement separate ad hoc loading/empty/error blocks.
- `StatusBadge`/`StatusInline` tone logic overlaps; status labels are passed as raw strings and formatted inconsistently.

## 8. Duplicate actions

- Module creation appears in `PageHeading` and again in the `DataTable` toolbar.
- The table view and card view have separate pagination and result-count markup.
- Dashboard has a `New order` action, while the Orders page is also the only place that can start the order workflow; the shortcut is useful but currently rendered disabled for users without the permission instead of being hidden or replaced with an allowed action.
- Record rows show a “More actions” icon that simply opens the record detail dialog; the label promises a menu that does not exist.
- The detail dialog then contains workflow actions for users/employees/deliveries/expenses, while related actions are also exposed through separate dialogs. This is a reasonable place to centralize per-record actions, but it needs a real row action menu and a clear single entry point.

## 9. Dead or non-functional controls

- Profile “My profile” and “Settings” actions only show “coming soon” toasts.
- Sidebar help card is not actionable despite its help-center copy and external-link icon.
- Branch scope has button-like styling and hover behavior but no selector behavior or branch menu.
- `Design system` is a live route but is grouped as “Preferences”; its sample inputs are unlabeled and it does not demonstrate the control types called for in the design system.
- `PageHeading` contains decorative date metadata on pages that do not need it.
- Dashboard KPI sparklines are hard-coded CSS shapes, not trends derived from data. Each KPI also repeats “Live data” alongside a second explanatory note.
- `ModulePage` renders disabled add buttons for unsupported create workflows (for example payroll, reports, audit logs) and a disabled “Read only” button inside generic record details. These make unavailable features look interactive.
- The static “Updated just now” note is not tied to query timestamps.

## 10. Responsive problems

- Breakpoints are spread across 1500, 1120, 900, 700, 500, and 420px. There are repeated 700px and 900px blocks, with the sidebar behavior appended near the end of the stylesheet after feature rules.
- Tablet uses the same off-canvas drawer as phone. The dashboard grid remains two columns through tablet widths; module tables stay desktop tables with horizontal scrolling unless a user finds and selects the alternate card view.
- Card view is an optional manual mode, not an adaptive mobile representation; its data and controls differ from the table and it has independent pagination.
- Page actions are forced into equal-width buttons on mobile, regardless of hierarchy or label length.
- Fields are stacked by default, with a few domain-specific two-column grids. Several forms only collapse their grid at 700px or 500px, so the breakpoint strategy is inconsistent.
- Dialogs remain centered, max 440px wide, max 85vh high on narrow phones; there is no sheet/full-screen presentation for long role or transfer forms.
- The active responsive breakpoints do not match the requested 375/390/430/768/1024/1280/1440 QA set exactly. There is no automated viewport rendering setup.

## 11. Form and modal problems

- `ConfirmDialog` provides shared title/description/close behavior, but every form repeats labels, required markers, errors, selects, and action footers. Inputs and labels are often 9–10px, below comfortable business-app reading sizes.
- Most modal forms are a single column even where related fields can share a two-column desktop layout. Specific transfer/order/report forms add their own grids and late CSS overrides.
- Native selects and date/number controls are already present. Improvements should use them or existing data to offer correct choices; do not invent business enumerations or API fields. The employee position, delivery driver, and some generic categories currently have no option source, so changing them to fixed dropdowns would invent values.
- `CreateRecordDialog` derives generic fields from `create-fields.ts`, has only required-field validation, and uses strings for number fields. It does not expose a shared error/description association pattern.
- `UserAccountDialog` uses a small native checkbox for cross-branch access; a switch presentation could clarify the on/off behavior. `RoleManagementDialog` appropriately uses checkboxes for multi-permission assignment but lists raw permission keys in an ungrouped grid.
- `RoleManagementDialog` can open its delete confirmation while the role-management dialog is still open, so two modal layers can compete for focus and escape handling.
- `ReviewExpenseDialog` has local manual validation and state rather than React Hook Form. Errors are adjacent text but not consistently associated with inputs using `aria-describedby`/`aria-invalid`.
- The shared modal remains scrollable, but action footers scroll with long content and the component does not provide size/intent variants for standard, wide, destructive-confirmation, or mobile-sheet cases.

## 12. Table and list problems

- `DataTable` is a custom server-driven HTML table. This is still a reasonable fit for the current API contract; `@tanstack/react-table` is available but unused, so adoption should depend on whether column visibility, selection, or more complex client behaviors are actually needed.
- The table supports server search/sort/status filter, page size, previous/next, and current-page CSV. It lacks clear active-filter chips/one-click reset, and the status filter only appears when a column is named exactly `Status`.
- The action column has no real dropdown. Row activation opens a generic detail modal; `More actions` is a misleading accessible label.
- The grid-card path is manually rendered in `ModulePage`, uses only the first two fields, and synthesizes “Active” when no status exists. That can misrepresent audit/log rows.
- On phones, the default table has a 630px minimum width and is horizontally scrollable. Card mode is optional and sorting is unavailable there.
- The same record total appears in the module summary and table footer. The summary also adds a fake recency line and current month with no data meaning.
- Loading uses a generic blank/empty-style box rather than table skeletons; error messages expose raw `Error.message`. Dashboard panels can show “No orders yet” after an error while a separate footer reports the query error.
- Generic row values are raw strings. Dates, currency, quantities, branch labels, and primary/secondary values are not consistently formatted by column semantics.

## 13. Inconsistent UI patterns

- The active design system is a mix of Tailwind reset/utilities and handcrafted global CSS. Brand/surface variables exist, but many component and status colors remain hard-coded.
- Text sizing ranges down to 8px table headings/footer and 9–10px fields/buttons. Touch targets are 32–38px in many controls; only selected mobile header controls reach 44px.
- Border-heavy cards, inputs, panels, permission fieldsets, dialog footers, and tables stack borders inside one another. The design relies on boxes rather than whitespace, surface contrast, and typographic hierarchy.
- Light and dark semantic tokens exist, but semantic status colors are duplicated and some dark rules are separate hard-coded overrides.
- Button variants are named global CSS classes, but there is no typed variant component to centralize disabled/loading/icon/size behavior.
- The design-system sample is not a comprehensive or accessible reference for actual production controls.

## 14. Missing or conflicting feature states

- No route-level React error boundary is configured.
- No consistent skeleton, error/retry, permission-denied, and empty-state components are shared across dashboard, module, and report pages.
- Unknown one-segment paths reach `ModuleNotFound`, but deeper unknown paths fall through to a redirect, so not-found behavior is inconsistent.
- Current modules are metadata-driven and include users/roles, branches, employees, customers, suppliers, products, inventory/transfers, orders, payments, deliveries, vehicles, expenses, payroll, reports, and audit logs. Projects and real application Settings are not currently routed modules; they should not be invented as part of visual cleanup.
- Feature options are retrieved through existing endpoints and gates. The top-bar branch label has no branch-switch options endpoint in the current UI contract, so branch switching is not available to implement without a separate API/product decision.
- Session loading/error, option loading, query failure, and mutation failure handling are spread across pages/forms rather than standardized.

## 15. Accessibility and interaction findings

- Positive foundations: visible global `:focus-visible`, semantic labels around most native form controls, permission-filtered navigation, a manually implemented drawer focus trap/scroll lock, keyboard activation for table rows, and Radix Dialog focus behavior.
- The table row itself is focusable/clickable, but its child “More actions” button is not an action menu and can create ambiguous interaction semantics.
- Dynamic field errors generally lack explicit `aria-invalid` and `aria-describedby`; the report region uses `aria-live`, while most query and mutation feedback relies on toasts or plain text.
- `BranchSalesPanel` and other navigation actions use buttons for route changes rather than links. Help/profile placeholder controls add inaccessible or misleading actions.
- Mobile background inertness and drawer close/focus logic are split across a custom scrim, `inert`, two key handlers, and CSS visibility. A single tested dialog primitive should own those interactions.
- Status always includes text, which is good; the badge's tiny dot/color is supplemental rather than the only indicator.
- Design-system example inputs have placeholders but no labels. Some icon-only buttons have labels, but the `More actions` label does not match behavior.

## 16. Pages and areas requiring the most cleanup

1. **Application shell:** `AppShell`, `Sidebar`, and `Topbar` need one clear ownership model for desktop rail, mobile drawer, branch scope, theme, and account actions.
2. **Module list/detail:** `ModulePage.tsx` needs separation of list presentation, record detail/actions, and workflow dialog orchestration without changing API calls, permissions, or invalidation.
3. **Users & Roles:** the generic user table needs proper mobile records and a real row action menu; role permissions need readable grouping and confirmation dialogs must not compete with the editor modal.
4. **Shared table and page header:** remove duplicate create ownership, establish one page action hierarchy, share breadcrumb semantics, and make responsive record views use the same data/query state.
5. **Forms and dialogs:** distinguish a generic form dialog from a true destructive confirmation; standardize field labels/errors/sizing and use choices only when backed by current options/API enums.
6. **Dashboard:** remove synthetic trend/recency decoration, make loading/error/empty states consistent, improve readable KPI labels, and retain shortcuts only when they are meaningful and allowed.
7. **Reports and authentication:** share the page header and state components; improve date-range feedback and preserve the existing API payload behavior.
8. **Design-system page and CSS:** make the page reflect real shared controls and break the global stylesheet into documented foundation, shell, shared-component, feature, and responsive layers as each area is refactored.

## Reuse/refactor/remove decisions

| Decision   | Current elements                                                                                                                                                                                          | Audit direction                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reuse      | React Router, TanStack Query, API client, RHF, existing option queries, Radix Dialog, Sonner, module metadata, theme/brand tokens                                                                         | Preserve data contracts and current permission gates.                                                                                              |
| Refactor   | AppShell, responsive nav, `PageHeading`, `ModulePage`, `DataTable`, role dialog, report/dashboard query states                                                                                            | Separate responsibilities and give desktop/tablet/mobile explicit behavior.                                                                        |
| Centralize | Page container/header/breadcrumbs/actions, field labels/errors, status tone mapping, query states, button variants                                                                                        | Build a small shared layer around recurring behavior, not a universal form/table framework.                                                        |
| Remove     | Static help card, placeholder profile/settings actions, synthetic KPI sparklines/recency, duplicate table create button, unsupported disabled create/read-only controls, redundant date/breadcrumb labels | Keep only controls backed by a real action or useful information.                                                                                  |
| Replace    | Desktop-as-drawer presentation, custom split focus/scroll management, optional squeezed-table card toggle, misleading “More actions” control                                                              | Use an intentional mobile sheet, one accessibility owner, responsive record cards with the same filters/pagination, and an actual row action menu. |

## QA and constraints

- `npm run typecheck` passes at the end of this audit.
- `npm run test:e2e` now starts an isolated migrated PostgreSQL/API/Vite test environment and Playwright. Generated screenshots/reports are ignored artifacts; CI runs the same suite. Shared `FieldHeading`, controlled-dialog focus restoration, and `AppToaster` positioning were fixed from rendered evidence. See `FRONTEND_ARCHITECTURE.md` for runner details and exact coverage.
- The original frontend-only audit preserved endpoint paths, payload shapes, permissions, and business rules. The subsequent development audit authorized the backend account/role detail and access-control fixes described below. New selector/combobox options must still come from API data or an agreed contract.
- Implementation order for the next phase should follow the requested sequence: shell; tokens/shared rules; desktop/sidebar and dedicated drawer; shared page structure/actions; responsive tables; dialogs/forms; Users & Roles; remaining modules; responsive/accessibility QA; dead-code cleanup and documentation.

## Administration continuation — 2026-10-01

- Extracted Users page/query/mutation ownership from `ModulePage` into `features/users`. Typed account detail now presents stored identity, role, branch scope, creation/update/last-login metadata, current grants, management eligibility, and permission-gated real history.
- Split the role editor into focused field, searchable grouped permission, and history components. Readable descriptions preserve backend permission keys. Usage counts distinguish the actor's branch from all branches; protected, shared, and higher-access roles remain read-only when the server denies management.
- Fixed duplicate permission pickers caused by colliding sibling React keys. Role switching/create mode now renders exactly one picker. Removed obsolete role styling from the shared responsive stylesheet.
- Fixed lost role/branch selections when native selects mounted before their options, using controlled RHF fields. Retry and same-record refresh preserve drafts; account/password forms expose matching confirmations and associated validation/submit errors.
- Shared lists retain current rows during filter/search/sort/page requests, preserving focus and continued typing. Refreshes announce busy state and defer export/pagination until matching rows arrive. Previous rows are not reused when changing modules.
- Root semantic theme tokens now apply to status badges and destructive controls inside Radix portals. The prior app-descendant dark selectors left dialog badges on light surfaces.
- The combined suite contains 35 acceptance checks (32 rendered scenarios and 3 arithmetic checks), including seven widths, desktop/phone administration and order workflows, privilege/branch denials, session revocation, list controls, recovery states, modal focus/bounds, and theme consistency. Comprehensive screen-reader/contrast, export, all-role, and remaining-module acceptance are still required.

The backend audit also fixed existing-account branch takeover and grant-ceiling bypasses, shared-role mutation scope, session revocation based on actual access changes, atomic lockout, and stale-password login races. These are functional security corrections; the frontend's hidden actions do not replace them. See `md-docs/project/progressreport.md` for verified results and the next Inventory priority. Self-service account recovery, attachments, global delegation policy, and production operations remain separate work.
