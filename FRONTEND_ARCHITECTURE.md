# CBMS Frontend Architecture

This document describes the frontend as it is implemented today and gives conventions for extending it. It complements [`CBMS_FRONTEND.md`](./CBMS_FRONTEND.md), which is the product and design specification; it does not claim that every item in that specification has been implemented.

## Runtime and request flow

### Connectivity and failure handling — 2026-10-02

`features/dashboard/dashboard.api.ts` owns the summary request and validates its response with `dashboard.schema.ts`; dashboard types no longer live in the generic module API/types files. Authentication similarly validates session responses in `features/auth/auth.schema.ts` before authenticated components use them.

`services/api/client.ts` remains the only request/download transport, with cookie credentials. `services/api/errors.ts` classifies unreachable backend, expired session, forbidden access, server/service failures, rate limits and invalid responses. HTML, malformed JSON, and invalid dashboard/session shapes produce safe invalid-response errors. Development diagnostics log only method/status/code/kind, without URLs, request bodies, cookies or response data. A 401 clears protected cache and explains session expiry; session startup failures offer recovery rather than showing a false signed-out state, while a transient session recheck failure retains existing authenticated navigation.

`components/common/QueryState.tsx` centralizes announced loading/error states and appropriate retry actions. It replaces InventoryState, ExpenseState and the FleetState helper; feature-specific states continue to compose it with existing CSS. The obsolete generic RecordPaymentDialog, getPaymentOptions, getPermissionDescription and unused payment types were removed after source/test/config/documentation reference checks. The active customer-payment workflow retains exact money, history and replay behavior. Unrendered demo-banner/pulse CSS and unused direct class-variance-authority/clsx/tailwind-merge declarations were removed; clsx remains a Sonner transitive dependency. TanStack Table remains reserved by the approved product specification.

Vite uses strict port 5173 and proxies `/api` to the configured development API origin (default port 3000). The client defaults to `/api/v1`, matching production nginx. `CBMS_API_PROXY_TARGET` is server-only; explicit cross-origin `VITE_API_URL` remains supported. Startup validates API/proxy settings, rejecting relative prefixes outside the configured proxy and keeping invalid values out of diagnostics. See the root [connectivity audit](../CONNECTIVITY_ARCHITECTURE_AUDIT.md) for the schema-mismatch incident and checks.

```text
src/main.tsx
  └─ AppProviders (TanStack Query, Sonner)
      └─ App (session query and React Router routes)
          ├─ LoginPage
          └─ AppShell (authenticated layout and ModuleRuntimeProvider)
              ├─ Desktop Sidebar / Topbar / Mobile Drawer
              └─ PageContainer (dashboard, reports, or module)
                  └─ feature API function
                      └─ services/api/client.ts
                          └─ CBMS REST API
```

The source is organized by app infrastructure, shared components, and product features:

| Location                         | Responsibility                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/app`                        | Route composition and application-wide providers.                                                  |
| `src/components/layout`          | Authenticated shell, desktop sidebar, mobile drawer, shared navigation links, and top bar.         |
| `src/components/common`          | Shared breadcrumbs, page heading, dialog frame, status display, and record list.                   |
| `src/components/user`            | Desktop account disclosure and sign-out action.                                                    |
| `src/styles`                     | Central responsive rules, loaded after the global design tokens and component styles.              |
| `src/features/auth`              | Session query, login/logout API calls, types, and login screen.                                    |
| `src/features/dashboard`         | Dashboard query, derived summaries, and dashboard panels.                                          |
| `src/features/design-system`     | In-app palette and component reference page.                                                       |
| `src/features/modules`           | Module metadata, record API functions, list page, workflow dialogs, forms, and report page.        |
| `src/features/modules/hooks`     | Module-owned data and mutation hooks, currently including module-page query orchestration.         |
| `src/features/users`             | Users page, account detail, administration mutations, and user-specific styles.                    |
| `src/features/fleet`             | Fleet lists, vehicle specifications, assignment/maintenance forms and details, APIs and mutations. |
| `src/features/driver-allowances` | Allowance list, approval/release/receipt forms, typed API and finance dialogs.                     |
| `src/features/customer-payments` | Order receivables, immutable receipts, recording/details, types and API.                           |
| `src/features/inventory`         | Authoritative stock detail, movement ledger, adjustments/reorder, typed API and mutations.         |
| `src/features/expenses`          | Exact submission, actual review/source/history, private proof visibility and expense page state.   |
| `src/services/api`               | Credentialed REST client and file download handling.                                               |
| `src/utils`                      | Small shared formatting helpers.                                                                   |

`src/hooks` and `src/lib` currently have no source files. Prefer placing a hook beside the feature that owns it; add a shared hook only after more than one feature has a clear use for it.

The `features/driver-allowances` entry below describes the current application, not the target product structure. The page/workflow is pending retirement in favor of Payroll. Keep any migration read-only or otherwise capable of closing existing records until a production-safe legacy closeout plan is implemented; see the root [`decisions.md`](../decisions.md).

## Routes, sessions, and permissions

`src/app/App.tsx` waits for `useSession()` before rendering routes, sends signed-out users to `/login`, and wraps authenticated pages in `AppShell`. The index route goes to the dashboard. Unknown routes currently redirect to the dashboard or login rather than showing a not-found page.

`useSession` stores the cookie-backed session in TanStack Query. Login seeds that cache after a successful request. Successful logout clears the session and protected queries; a network failure is shown to the user. A 401 from a protected request also clears cached access, and the session is rechecked when the window regains focus. The backend remains the authority for access control. Both desktop and mobile navigation use the same permission-filtered `NavigationLinks`; unsupported create actions are hidden from the page header, while API endpoints continue to enforce permissions independently.

`ModuleRuntimeProvider` exposes the current user's ID, permissions, branch scope, and the shared create-record mutation to module screens. Direct module routes check the module's read permission before rendering data; permission-gated queries remain disabled without it. Keep unrelated feature state out of this context.

## State and data fetching

TanStack Query owns remote state. The shared client uses a 30-second stale time, retries failed queries once, and does not refetch on window focus. Query keys are declared in feature-local hooks and pages. Module option-query gates live in `useModulePageQueries`; its query keys and permission conditions match the module workflow. Mutations invalidate affected module, dashboard, and option queries where relevant.

Local interaction state stays in its closest owner: the shell owns navigation and theme; the desktop top bar owns its account disclosure; `ModulePage` owns the remaining module workflows; `UsersPage` owns user selection, list filters, and account/role dialogs; forms own their field state through React Hook Form. Avoid copying query results into component state unless a user is editing a draft.

`UsersPage` keeps the prior list with `placeholderData: keepPreviousData` while search, sort, filters, and pagination request another result. The table stays mounted, preserving the focused search input. Its `busy` state announces refreshes and disables export and pagination until the matching response arrives. User-detail history pagination also retains the current account context while fetching the next history page. Initial loading, query failure/retry, and empty results remain explicit states.

## API boundary

Feature API modules (`auth.api.ts`, `modules.api.ts`, `fleet.api.ts`, `allowances.api.ts` and `customer-payments.api.ts`) describe endpoints and typed payloads. `services/api/client.ts` centralizes `VITE_API_URL`, JSON requests, cookie credentials, `ApiError`, and CSV/file downloads. API calls should stay out of reusable presentation components. Keep error messages useful to users, and invalidate related query keys after successful writes.

## Layout, design tokens, and responsive behavior

`AppShell` owns the authenticated layout. The desktop sidebar is a fixed rail; at widths up to 900px it is hidden and the top bar opens a separate Radix mobile drawer. Desktop collapse is a persisted 72px icon rail; each icon has a visible hover/focus state and a tooltip rendered outside the scroll container so it is not clipped. Desktop and drawer navigation share the same permission-filtered link component. The drawer has an account summary in its header, independently scrolling navigation, and a sign-out footer. Radix manages focus trapping, Escape/backdrop dismissal, focus restoration, and scroll locking; the drawer also closes after route changes, including browser history navigation. The branch label is informational until the API supports switching. Theme choice is persisted locally.

The active design implementation is handcrafted CSS in `src/index.css`, with palette and surface variables declared at `:root`. The selected theme is reflected on both the app root and `document.documentElement[data-theme]` so Radix portals inherit dark surfaces and text colors. Responsive rules live in `src/styles/responsive.css`, imported after the base stylesheet. Tailwind is configured and its directives are loaded, but the application styling is primarily named CSS classes rather than utility classes. The UI uses Lucide icons, Radix Dialog for accessible dialog behavior, Sonner for toasts, and native HTML tables. It does not currently use shadcn/ui components. `@tanstack/react-table` is installed but the current `DataTable` is a custom server-driven table.

The shell breakpoint is 900px (desktop rail vs. mobile/tablet drawer). Module and report lists switch to cards at 800px, with the same filter, server sort, and pagination state as the desktop module table. Dashboard recent orders switch to cards below 1120px to account for the space used by the desktop sidebar. At phone widths, dashboard panels and long forms collapse to one column; page actions wrap according to their hierarchy. Dialogs use a wide desktop size where appropriate and become bottom sheets on compact screens. Shared responsive rules live in `responsive.css`; domain-owned rules may live beside their components, including `features/users/users.css` and `features/modules/roles.css`. These styles reuse the document's surface, text, border, and brand variables.

Use the existing CBMS blue/orange palette and CSS variables for shared surfaces, borders, text, and shadows. Extend a token before adding a one-off color. Keep touch controls around 40–48px where space allows, and provide a `:focus-visible` treatment for keyboard users.

Status badges and destructive buttons use semantic foreground/surface/border/hover tokens on the document root. Dark colors therefore propagate into Radix portals as well as page content; app-descendant selectors previously left dialog badges on the light palette.

## Shared UI and forms

- `Breadcrumbs` supplies semantic, shared navigation context where a trail is useful. `PageHeading` aligns page title, description, and page actions; it does not append decorative dates.
- `AppDialog` wraps Radix Dialog and supplies a shared title, description, close control, and standard/wide sizing. It restores focus to the last connected opener even when a controlled dialog has no Radix Trigger. Browser tests cover Escape, focus restoration, and modal bounds. Role deletion closes its editor before confirmation.
- `FieldHeading` groups label text and its decorative required marker on one line inside the existing vertical field layout. Field validation belongs to the form. Required semantics must also be supplied by the input's native `required` or `aria-required` attribute; the decorative marker alone does not provide them.
- `DataTable` owns server-list search debounce, sorting, status filtering, formula-safe CSV export of the current page, pagination, and context-aware empty results. It renders a sortable desktop table and mobile record cards from the same rows and state. Its optional `busy` prop sets `aria-busy`, shows an updating state, and guards export/pagination while replacement rows load. The action is labelled “View details” because it opens the record rather than a menu.
- `RecordHistoryPanel` presents actual account/role audit entries, actors, timestamps, empty history, and bounded Newer/Older pagination. Its buttons are explicitly non-submit controls so the panel can appear inside an editor form. Permission checks and branch filtering belong to the backend; feature owners decide whether to fetch/show audit history.
- `StatusBadge` and `StatusInline` use the shared `utils/statusTone.ts` mapping so a status has the same semantic tone in tables and dashboard lists.
- Structured workflow forms use React Hook Form; use Zod where a frontend schema is already part of the feature. Keep validation near the form and endpoint rules in the backend.
- `AppToaster` configures Sonner centrally: closable feedback appears above compact forms on phones and at the bottom right on larger screens; its theme follows the same document theme as dialog portals. Loading, error, and empty states remain in the owning page.

## Users and roles

`ModulePage` checks the module read permission before delegating the Users route to `features/users/UsersPage`. User list, account options, role list, and role-permission queries belong to that page; the generic module-query hook disables its Users list query to avoid duplicate requests. Account options load when the account form opens. Role choices and permission options load when the role editor opens, and read-only role access does not wait for a disabled write-options query.

`useUserManagement` centralizes user creation/editing, activation, administrator password reset, and role writes. A pending-action ref prevents overlapping submissions. Successful writes invalidate the user list/detail, assignment options, role list/detail, and affected summaries; role writes also refresh grant options and the current session. Failed writes preserve the open form and expose the actual API error through toast and inline account/password/status feedback.

`UserDetailDialog` reads the typed account detail endpoint rather than reconstructing account values from table strings. It shows identity, role description, home branch, branch access, account timestamps, last sign-in, and readable role permissions. Edit, reset-password, activation, and delete controls require the frontend write grant and the backend's `canManage` result; deletion is only offered to an Administrator. Its confirmation explains that account email and audit/business history are retained. Management restrictions use the returned reason; audit history is shown only with `audit.read`. The API remains responsible for self-administration limits, permission ceilings, branch isolation, protected administrator rules, deletion, and session revocation.

`UserAccountDialog` shares create/edit fields while keeping email immutable on edit and initial-password fields exclusive to creation. Password creation and reset require matching confirmation fields. Role and branch selects use React Hook Form `Controller` so saved selections survive delayed option or portal mounting. Option errors provide a retry without resetting the entered draft. Required state and field errors connect to their controls with `aria-required`, `aria-invalid`, and `aria-describedby`; submission failures stay visible within the form. Company-wide access is determined by the built-in Administrator role, not a free-standing checkbox. Selecting that role sets the access value and explains the result; custom roles remain branch-scoped. The Administrator may keep an optional home branch for record display, but it does not restrict company-wide access. The backend validates this pairing and authenticates its effective scope on both login and subsequent sessions.

`RoleManagementDialog` owns selection, create/edit drafts, submission, and deletion confirmation. `RoleEditorFields` renders role identity, description, creation date, and usage count. Counts returned for a branch-scoped viewer are labelled “Users in your branch”; cross-branch viewers see “Assigned users”. Assigned roles cannot be deleted, built-in roles remain protected, and the server's `canManage`/`managementReason` also guard shared or higher-access custom roles. Read-only accounts can inspect locked roles without write controls.

`RolePermissionPicker` renders native keyboard-accessible checkboxes grouped by module, with search, descriptions, and a selected count. `permission-labels.ts` supplies readable labels for both the picker and account detail while preserving raw backend keys and request payloads. The picker includes currently selected permissions even when the viewer cannot grant them, preventing hidden access from being silently dropped. The form only resets when the selected role or create mode changes, or the editor reopens; refreshing the same role does not erase an unsaved draft.

`RoleHistoryPanel` fetches role detail/history through the typed feature API and reuses `RecordHistoryPanel`, with its own loading and recoverable error state. The editor mounts it only for audit readers. Permission-picker and history children use distinct `permissions:` and `history:` key namespaces: each includes the role ID, but the prefixes prevent sibling key collisions and duplicate retained DOM when switching roles or opening a new-role draft.

The Users & Roles browser suite baseline passes 15 scenarios. The updated account deletion lifecycle was also verified at 390px and 1280px, including confirmation bounds and sign-in/session denial; this does not replace the remaining exhaustive authorization, assistive-technology, or production acceptance work.

## Business record lifecycle pattern

Employee is the reference implementation for a domain-owned lifecycle. `EmployeeRecordDialog` collects the schema-supported identity, employment, branch, contact, hire-date, and status fields. `EmployeeDetailDialog` fetches `/employees/:employeeId`, shows the complete stored record and paginated audit history, and exposes permission-gated edit/archive actions. It owns loading, error, empty-history, retry, and compact-screen behavior. Driver capability, license, availability, emergency contact and notes are part of the employee record. Private financial proof storage now exists; employee documents still need their own supported parent/permission policy before adding controls.

Branches, Customers, Suppliers and Products currently share a smaller managed-record lifecycle. `ManagedRecordDetailDialog` reads the flat camelCase detail response, conditionally displays related data and audit history already filtered by backend permissions, and opens the shared `CreateRecordDialog` in edit mode. The same field configuration drives create and edit so schema-supported fields do not drift between forms. Archive always uses a confirmation and the backend may return `RECORD_IN_USE` when active assignments, stock, or open work must be resolved first.

For a new record lifecycle:

1. Add stable IDs to list rows and a typed API detail response.
2. Keep authoritative field validation, permission checks, relationship checks, and branch scope in the service layer.
3. Use real related-data and audit queries; do not manufacture timeline events in the browser.
4. Reuse the create form for edit only when the field rules genuinely match. A domain-specific form is preferable when the lifecycle diverges.
5. Invalidate the module list, selected detail, relevant option queries, and dashboard summaries after writes.
6. Preserve loading, error/retry, empty, permission-hidden, confirmation, and responsive states.

The shared managed lifecycle supports the approved stored fields, with nullable branch email, employee address, and product specifications introduced additively. Employee name parts and salary/payroll configuration, transfer dispatch/receipt, and customer delivery proof still need approved rules/schema/API work. Vehicle specifications and driver workflows now have a dedicated domain owner. Order cancellation, manual payment refunds, and returns use dedicated lifecycle endpoints rather than the generic record form.

Orders use `OrderDetailDialog`, `OrderWorkflowActions`, and `OrderWorkflowDialogViews`. The detail presents payable value, recorded payments, processed refunds, net paid, balance, line progress, linked histories, and inventory movements. The backend filters audit history and remains authoritative for eligibility and permissions. Actions support completion, line cancellation, refund request/review/manual processing, and return request/review/receipt. A partly resalable receipt collects the non-resalable remainder's condition and shows both quantities; only accepted resalable goods increase stock.

`order-decimals.ts` uses integer cents/milliunits for refund availability, returned quantities, and currency/quantity formatting. Order, refund, and return creation retain a request key for an unchanged form after an ambiguous network failure; changing the payload creates a new intent. Order keys are bound server-side to the submitting actor and normalized customer, branch, product, and quantity intent. A retry returns the original order before rechecking live stock/customer state, while route permission and branch checks still run for every request. Lost-response browser and PostgreSQL tests verify that one order, reservation, movement, and audit event persist. `CreateDeliveryDialog` requires explicit line quantities. Writes invalidate the affected detail, lists, options, inventory, and dashboard queries.

`LegacyDeliveryReconciliationPanel` appears only when server eligibility marks inferred historical allocations unverified. Delivery-update permission allows loading and confirming every line's actual quantity with a document note. Verification is audited without changing physical stock; historical transactions that make correction unsafe require separate manual review. The API guards delivery, return, completion, and cancellation until verification is resolved. New reserved orders use recorded allocations and do not enter this flow.

Core order/payment/delivery/refund/return workflows now pass rendered desktop/phone acceptance and seven-width shell/order/form checks. Dedicated PostgreSQL/HTTP tests cover branch isolation, action permissions, concurrency, linked audit, legacy verification, and financial summaries. Comprehensive module list/export, screen-reader/contrast, all-role, and production acceptance remains. Settlement is manual bookkeeping; no external payment provider is connected.

## Fleet, allowances and customer payments

`ModulePage` checks each read grant, then delegates to `FleetPage`, `DriverAllowancesPage` or `PaymentsPage`. The generic query hook disables the corresponding generic reads, and obsolete generic vehicle create/edit/detail paths have been removed. Shared module metadata still defines navigation, columns and grants; domain logic belongs in the feature.

`FleetPage` owns list selection and vehicle/maintenance/assignment dialogs. `useFleetMutation` centralizes submission guards, readable errors and invalidation of fleet lists/detail/options, delivery/order data, reports and dashboard. `VehicleRecordDialog` reuses stored values on edit. `FleetFields` supplies explicit labels, native numeric/date/textarea controls and controlled React Hook Form selects so delayed option loading does not erase selected IDs. Types/units/repair types suggest defaults and existing stored choices while allowing another configured value.

Vehicle detail keeps current maintenance prominent: problem, start, recorded cost, provider and latest update. It separately paginates assignments, maintenance records and real audit; `RecordPagination` shares bounded Newer/Older controls. Changing a history page does not hide the current repair. Record-history permissions remain server enforced. Status/expense/proof actions reuse confirmations and the shared dialog frame.

Delivery forms pair a real employee driver with an available vehicle and retain explicit order-line quantities. The backend validates conflicts and posts fleet transitions with existing delivery/stock changes. Scheduled assignments reserve both resources until completion/cancellation. Vehicles now have a branch owner: branch users see only their assigned branch's vehicles and matching driver/operational options; Admin can filter the register and fleet reports across branches. Legacy vehicles with no consistent assignment/maintenance history remain unassigned and Admin-only pending review. Assignments, maintenance and allowances also follow their recorded branch. Historical free-text driver values are retained without inventing employee links.

Allowance forms use branch/employee/type/timing/method/related-record controls. Financial fields are editable only while Pending. Approval, release, cancellation and receipt use their own grants and record-specific confirmations. A receipt requires a parent-owned proof or acknowledgement and a valid actual received date. Regular salary/payroll remains separate; selecting Payroll as a method records a manual method without creating an automatic pay run.

`PaymentsPage` lists order receivables, including orders with no receipt. Mobile cards explicitly retain total/net paid/balance/status rather than squeezing the desktop columns. `CustomerPaymentDetailDialog` returns the exact balance and immutable receipts/refunds/history from one financial snapshot. `RecordCustomerPaymentDialog` uses a controlled order picker, actual date, proper method selector and a request key retained for an unchanged retry. Recording a second payment creates another receipt and never overwrites the first. Due dates/Overdue are omitted because no approved credit-term/invoice model exists.

## Shared private proofs and analytics

`ProofUploader`, `AttachmentList` and `proofs.api.ts` share upload/list/download behavior for payment receipts, allowance receipts and maintenance. Cache keys include entity type and ID. UI actions use the actual parent/action grants; the API independently authorizes the parent's real branch before reading/writing private storage. Uploads are bounded JPEG/PNG/WebP/PDF with extension/type/signature checks; files use opaque keys. Downloaded proof content uses authenticated attachment responses, not a public object URL. Allowance Received additionally verifies a physically readable parent-owned proof when proof is selected. Production uses the existing AWS SDK private R2 adapter; provider acceptance remains separate from local checks.

`OperationsSnapshot` adds permission-filtered fleet availability, monthly completed repair cost, unreleased allowances/receipt follow-up and customer balances. Maintenance costs remain distinct from expense approval; salary and customer due dates are not inferred. Reports reuse the existing report page/table/mobile cards and safe CSV client. `report-options.ts` owns the nine report choices/statuses and `ReportFilters` owns applicable date/vehicle/driver/customer/status controls with retryable option loading. Current snapshots disable date filters; dated reports explain which event date they use. Backend domain grants, actual branch scope and export audit are authoritative.

## Inventory ownership

Inventory now has a dedicated owner under `features/inventory`: page/list state, detail, movement ledger, adjustment/reorder dialogs, typed API calls, and mutations. It reuses `DataTable`, `AppDialog`, `RecordPagination`, `RecordHistoryPanel`, existing tokens, and exact decimal helpers. The generic Inventory form/options orchestration has been removed. There is one page-level Adjust stock action; detail actions preselect the actual product and branch. Mobile records show on-hand, reserved, available, and reorder quantities; the movement ledger becomes cards at 800px and below.

## Payroll ownership and pay model

`features/payroll` owns pay-run listing, period/branch options, draft entry composition, totals preview, run detail, processing confirmation, payment recording, and receipt acknowledgement. It reuses module list metadata and the shared `AppDialog`, `DataTable`, status, pagination, currency, toast, and private proof components. ModulePage delegates Payroll and does not fetch a second generic result. Create submissions carry an intent-bound retry key; unchanged submissions reuse it after an uncertain network failure, while changed form values get a new key.

Payroll is the regular-pay model; `driver-allowances` remains the separate trip-allowance workflow. Each run entry stores a pay-basis/rate/units snapshot and separate additions/deductions. The API uses exact cents/milliunits, branch/employee checks, action grants, an immutable processed state, audit events, and parent-authorized proof. Draft runs can be created and edited through the detail UI; there is no stored employee default pay rate or statutory calculation.

Adjustment forms use controlled product/branch selects, Add stock/Remove stock radios, a bounded positive quantity input, and an optional note. Failed options or writes retain drafts and focus. A submitted intent UUID is retained for an unchanged retry and replaced only for a changed submission; the backend enforces single posting. Archived/inactive detail remains readable with stock/reorder write actions hidden. Reorder changes have a separate grant and never modify stock quantities.

`inventory-detail` keys include row ID and movement/history filters. Inventory writes refresh stock list/detail/options, reports/dashboard, orders/deliveries and transfer queries. Existing order/transfer creation, delivery status changes, cancellation, return receipt, and product/branch edits or archives also refresh the detail family. Movement labels use business wording while API filter values remain unchanged; physical and reservation deltas are separate. Unknown historical types show the recorded value without pretending to know its stock effect. Shared page CSV export waits while a typed search is pending or records are refreshing, preventing export of the previous search result.

Stock transfers keep the currently approved immediate, atomic-completion workflow. Each list row has a stable transfer ID and opens `TransferDetailDialog`, backed by a parent-scoped detail endpoint that permits users assigned to either the source or destination branch. It shows recorded item quantities, branches, requester, note, completion time, and paginated audit history only when `audit.read` is granted. Dispatch/receipt stages remain outside the current workflow until their operating rules are approved.

Delivery rows open `DeliveryDetailDialog` through `GET /deliveries/:deliveryId`. The service scopes access to the order branch and returns order/customer context, the recorded destination and schedule, allocated order lines, legacy allocation-verification metadata, and the linked fleet assignment when present. `deliveries.read` grants the detail; `audit.read` separately grants its paginated history. The existing status form remains the only transition action. Customer proof and any dispatch policy are not inferred from this read view.

## Browser acceptance

Run `npm run test:e2e` from the frontend after installing both projects' dependencies and configuring a PostgreSQL URL in the backend `.env` or `TEST_DATABASE_URL`. The runner creates and migrates a randomly named disposable database, inserts isolated users/business records, starts API/Vite on 3002/5180, runs Playwright, and removes its servers/database afterward. It never seeds or resets the development database. The database account needs create/drop access for these test databases.

`playwright.config.ts` uses installed Chrome/Edge on Windows or Playwright Chromium elsewhere. Run `npx playwright install chromium` if no compatible browser is installed. CI installs Chromium and operating-system dependencies, runs the suite with PostgreSQL, uploads screenshots/traces/report, and gates image publication on success. A hosted CI run is still unverified.

At the earlier shell/Inventory acceptance checkpoint, the combined suite passed 79 checks (76 rendered and 3 decimal-arithmetic checks), with 14 Inventory cases and 30 fleet/finance scenarios also passing focused dark-theme runs. Later focused results are listed in `../progressreport.md`: they include the current 10/10 Fleet browser suite and 8/8 Fleet report/dashboard suite. Coverage includes seven-width mobile/tablet/desktop behavior, connected fleet transitions and private proofs, branch options, retries, permissions, list actions, keyboard tooltips, loading/error/empty states and safe CSV. These checks remain scoped acceptance, not certification of every module or role.

## Current constraints and next refactoring seams

The current structure is serviceable but still transitional:

1. Users, Fleet, Allowances, Customer Payments and Inventory have dedicated feature owners; `features/modules/ModulePage.tsx` still coordinates unrelated Employee, order, delivery, expense, and managed-record workflows. Query orchestration lives in `hooks/useModulePageQueries.ts`; split the remaining responsibilities by workflow while preserving permissions and invalidation behavior.
2. `src/index.css` remains a large shared base stylesheet. Responsive behavior has been moved into `src/styles/responsive.css`; extract component and feature styles only when that improves ownership and avoids changing the cascade accidentally.
3. User page/detail/mutations now have a domain owner, while account/role form components and typed administration APIs still live in `features/modules`. Other workflows remain grouped there. Keep shared module metadata in place; move remaining domain components when extraction reduces coupling.
4. Playwright has verified core order/administration, fleet/allowance/payment flows, new reports and the shared shell. Extend the same disposable-data runner to remaining modules, exports, and comprehensive accessibility checks; the existing coverage does not certify those areas.
5. Profile/settings placeholders and the static, nonfunctional help card have been removed. Unknown routes still have no dedicated 404 page. Add account-management controls only when the account API supports them.
6. The implementation and approved stack in `CBMS_FRONTEND.md` differ: current styles are mostly custom CSS, dialogs use Radix directly, and the table is custom. Review that specification before introducing another component or styling system.
7. `README.md` previously pointed at `src/lib/modules.ts`; the actual module metadata is `src/features/modules/modules.ts`.

## Working conventions

- Keep feature-specific UI, schemas, types, hooks, and API functions with their feature.
- Keep shared components focused on stable behavior used by multiple features; avoid generic abstractions with only one caller.
- Use descriptive query keys and invalidate the smallest relevant query family after a mutation.
- Treat session permissions as presentation guidance only; the API is responsible for authorization.
- Preserve responsive behavior and keyboard access when changing shared layout or dialog components.
- Verify changes with `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`; run `npm run test:e2e` for changes affecting the shell, order workflows, or Users & Roles scenarios. Add meaningful acceptance scenarios when implementing new behavior.

## Expenses ownership

`features/expenses` owns list state, authoritative detail, submission/review dialogs, source metadata, typed API calls and mutation invalidation. ModulePage delegates to ExpensesPage; obsolete generic expense form/review state is removed. Shared AppDialog, DataTable, RecordHistoryPanel/Pagination and AttachmentList are reused.

CreateExpenseDialog uses controlled branch options, existing recorded-category suggestions with custom values, a compact description textarea and exact-cent input. Options failure has retry; failed submissions preserve draft/focus and reuse the same intent UUID until values change. Review actions only appear for Pending rows with the existing review grant. Conflicting decisions refresh the authoritative record and disable obsolete retries while keeping the losing note available.

Expense detail displays actual amount, submitter, branch, creation/update and recorded reviewer/decision/note/date. Full paginated audit additionally requires audit.read. Source links are real maintenance/allowance expense_id relationships within the same branch; source metadata and proof lists require the matching domain grant. Manual expenses do not expose fake source/upload controls. Mutation hooks refresh list/detail/options, reports/dashboard and connected fleet/allowance data.

## UI audit conventions and 21st context

The current pass extends existing primitives instead of adding another design system. `FormField` explicitly associates a label with its control and gives required/invalid/error descriptions stable IDs. Its render function passes attributes directly to native controls; it does not clone children or own form state. `FormOptionsState` separates catalog loading/errors/retry from a genuinely empty catalog. Older create/edit/order/transfer forms retain drafts and block dismissal during writes; server error messages are also shown inline.

Module metadata declares practical mobile columns for all business lists: amounts, branches, dates/schedules, contacts/terms and stock quantities remain visible in shared record cards. DataTable prefers stable row IDs with a compatibility fallback for older rows. Whole cards open actual record details; each page keeps one primary create action. The sidebar tooltip is available to keyboard focus independently of pointer type and clears on navigation/scroll/resize/expansion. Mobile navigation displays actual account branch scope and retains independent scrolling/scroll lock/focus restoration.

Essential helpers, table metadata, record history and errors use existing secondary/danger tokens. The shared link token reuses the existing brand blue in light mode and existing lighter blue in dark mode; hover underlines preserve contrast. Light warning/neutral foregrounds are slightly darker within their existing hues. Pagination uses readable 12px captions (11px at the smallest breakpoint), removing an obsolete 7px inherited rule. Undefined muted token references and fully superseded responsive declarations were removed. The order estimate uses the same integer cents/milliunits and per-line half-up rounding as the API; invalid partial editing values do not crash the form.

Read `../UI_UX_AUDIT.md` for page-by-page findings, priorities and verification limits. Project 21st skills are under `../.codex/skills`; local design context is `.21st/design.json` and `.21st/DESIGN.md`. The CLI initially missed custom primitives; the context was corrected from source. Deterministic review complements rendered QA, and its autofocus/color suggestions require interpretation. Catalog search is unavailable without credentials; no external hosted generation or configured MCP connection is claimed.

Light-theme secondary/muted text now reuses the existing neutral hue at #606d83 (4.84:1 on the page canvas; 5.23:1 on white). This fixes report labels, breadcrumbs and page descriptions through shared tokens. Dark text overrides remain unchanged. The report period uses readable 12px type. Final shared UI repeats verify actual rendered labels/descriptions/action/error contrast and captions in both themes.

## Keyboard access and route loading

The authenticated shell places a “Skip to main content” link before desktop navigation in document tab order. It becomes visible on keyboard focus and targets the page's semantic `<main id="main-content">`, moving users past navigation without changing route behavior. Preserve this order if shell components move.

Dashboard, DesignSystemPage and ModulePage are lazy route imports in `src/app/App.tsx`, each with a polite route-loading status inside the existing shell. Keep login and shared shell code immediately available, avoid replacing the entire shell during chunk fetches, and only split additional features when bundle or usage evidence justifies the extra boundary. The current production entry asset is 226.48 KB uncompressed; Dashboard, DesignSystemPage and ModulePage emit separate chunks.
