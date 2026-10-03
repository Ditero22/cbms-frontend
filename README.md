# CBMS Frontend

> Shared documentation: [index](../md-docs/README.md), [current production progress](../md-docs/project/progressreport.md), and [approved release scope](../md-docs/project/release-scope.md). This package guide retains product/architecture details and dated checkpoints. Older “current” counts, follow-up tasks and scope assertions yield to those canonical sources; a documented feature is not proof of completion.


React, TypeScript, and Vite application for the Construction Business Management System.

## Run locally

```bash
npm ci
npm run dev
```

The frontend uses the live CBMS API and cookie-based authentication. Keep `VITE_API_URL=/api/v1` in `.env.local`; Vite proxies `/api` to the local backend. Set `CBMS_API_PROXY_TARGET` if the local backend uses a different port. Start the backend and apply its migrations before using the application. The complete local setup is documented in [`md-docs/deployment/deployment.md`](../md-docs/deployment/deployment.md), and the latest verified work and remaining release items are in [`md-docs/project/progressreport.md`](../md-docs/project/progressreport.md).

Production builds require `VITE_API_URL=/api/v1` (or leave it unset). For Cloudflare Workers, set the build variable to that path and the runtime `CBMS_API_ORIGIN` to the HTTPS Render origin. Local `.env.local` also participates in production builds, so keep its API path relative. Never build a hosted site with a localhost API URL; the browser would request the visitor's computer. Absolute API URLs are supported only during development. Production traffic uses the configured server-side proxy and the existing same-origin security policy.

## Available scripts

- `npm run dev` — start Vite.
- `npm run build` — type-check and create a production bundle.
- `npm run preview` — serve the production bundle locally.
- `npm run lint` — run ESLint.
- `npm run typecheck` — check TypeScript, including browser tests/configuration.
- `npm run test:deployment-config` — verify production API configuration guards.
- `npm run format:check` — check source and test formatting.
- `npm run test:e2e` — run isolated API/database/browser acceptance.

## Browser acceptance

Install dependencies in both `cbms-backend` and `cbms-frontend`. Configure a local PostgreSQL source through the backend `DATABASE_URL` or the browser runner's `TEST_DATABASE_URL` override. The runner accepts only `localhost`, `127.0.0.1`, or `::1`, with source database `cbms_dev`, and rejects hosted or other targets before connecting. The account needs permission to create/drop its temporary test databases. From this frontend directory, run:

```bash
npm run test:e2e
```

The runner migrates and seeds its own randomly named database, starts test-only API/Vite servers on ports 3002/5180, runs Playwright, and cleans up. It also creates a private temporary proof directory and clears R2 configuration for the run, so uploaded test files do not enter development storage or a real bucket. Existing development records and servers are not used as fixtures. Override occupied ports with `CBMS_E2E_API_PORT` and `CBMS_E2E_FRONTEND_PORT`.

On Windows the configuration detects installed Chrome/Edge. If neither is present, or on other operating systems, install Playwright's browser with `npx playwright install chromium` (Linux CI uses `npx playwright install --with-deps chromium`). Reports and screenshots are written to ignored `playwright-report` and `test-results` directories.

The historical administration checkpoint passed 35 checks. A later checkpoint recorded **79 checks: 76 rendered scenarios and 3 exact-arithmetic checks**, plus a focused dark-theme fleet/finance repeat. Its backend results were **73 unit tests and 106 PostgreSQL integration cases across 14 files**, with **19 applied local migrations** at that time. These are historical figures; [the current report](../md-docs/project/progressreport.md) records the latest executed checks and remaining release gates.

Coverage includes the shared shell, core order workflows, Users & Roles, branch/permission limits, seven viewport widths (375/390/430/768/1024/1280/1440), compact forms, detail/action states, search/sort/pagination, and recovery states. Added scenarios exercise linked delivery/fleet transitions, allowance acknowledgement/proofs, immutable partial/final receipts, authenticated proof download, and report access/filter/export behavior. Fourteen Inventory scenarios verify fractional/reservation-safe adjustments, reorder consistency with dashboard/report, actual-branch and read-only access, ledger pages/filters, loading/error/empty/draft retry, lost-response replay and filtered safe CSV. Shared page exports wait for pending search and record refresh. See the architecture guide and progress report for coverage limits; sampled browser checks are not a full-module/all-role/accessibility certification.

Focused runs still use the isolated runner:

```bash
npm run test:e2e -- users-roles.spec.ts
npm run test:e2e -- fleet-workflows.spec.ts
npm run test:e2e -- customer-payments.spec.ts
npm run test:e2e -- fleet-finance-reports.spec.ts
npm run test:e2e -- inventory-workflows.spec.ts
```

## Implemented business workflows

- **Workers and drivers:** Employees remain the personnel source. Driver capability, license details, availability, emergency contact, and notes belong to the existing worker record. Assignment selectors use active eligible drivers; there is no duplicate driver/person record.
- **Fleet:** Dedicated register, vehicle detail, assignments, maintenance forms, and lifecycle confirmations replace the old generic vehicle editor. Vehicle detail shows operational state, default worker, dated records, costs, and paginated related activity. Global register access requires the appropriate vehicle permission and cross-branch access; branch staff receive scoped operational options/workflows according to their grants.
- **Delivery assignment:** Delivery forms can link a paired driver and vehicle. In Transit, Delivered, and Failed transitions start, complete, and cancel the linked assignment. The detail displays worker, vehicle, and plate. Linked trips are managed through the delivery lifecycle to keep statuses consistent.
- **Maintenance:** Scheduled → In Progress → Completed or Cancelled. Forms capture problem/provider/dates and exact labor/parts/other costs. Positive completion costs post one Pending expense for the existing expense approval flow. Completed/Cancelled records are locked; non-cancelled records support private receipt proofs.
- **Driver allowances:** Pending → Approved → Released → Received, with edits only while Pending and cancellation only before release. Release posts one Approved expense with the stored approver. Receipt requires an acknowledgement or readable proof belonging to that allowance. Methods/timing/types are deliberate selections, separate from regular salary.
- **Customer Payments:** The dedicated page shows one balance row per order, including unpaid orders, with Order, Customer, Total Amount, Amount Paid, Remaining Balance, Status, and Last Payment Date. Mobile cards keep the balance visible. A single primary Record payment action opens a compact form with order, exact amount, method, actual date, provider reference, and notes; detail exposes immutable receipt/refund history and proof controls.
- **Inventory:** Stable product/branch stock rows show on-hand, reserved, available and reorder quantities. Dedicated detail contains a paginated, filterable movement ledger and permission-gated audit. The ledger distinguishes physical changes from reservations and uses mobile cards. One page Adjust stock action opens controlled selectors, add/remove radios, exact positive quantity and optional note; unchanged retries reuse a UUID to prevent duplicate posting. Reorder maintenance has its own grant and before/after audit. Inactive stock history stays readable with write actions hidden. Stock-affecting actions refresh related detail, options, reports and dashboard.
- **Stock transfers:** A completed transfer detail shows the committed branches, item quantities, requester, note and completion time. Users scoped to either participating branch can view it; audit history additionally requires `audit.read`. The current workflow still posts immediately and atomically; separate dispatch/receipt stages need an approved operating policy.
- **Deliveries:** The detail view shows scoped order/customer context, destination/schedule, allocated lines, legacy allocation-verification metadata and any linked driver/vehicle trip. Delivery detail requires `deliveries.read`; audit history additionally requires `audit.read`. Existing status transitions stay in the current status form, with proof requirements reserved for an approved policy.
- **Reports and dashboard:** Domain-permission-gated fleet status/assignments/maintenance, allowances, current customer balances, and dated payment history use existing records. Reports offer applicable vehicle/driver/customer/status filters and audited CSV export. Current snapshots are labelled as current; dashboard summaries use the same financial calculations.

Payments use `/api/v1/payments` for the order-balance list and receipt creation, `/payments/options` for permitted collectible orders, and `/payments/orders/:orderId` for dedicated detail. `payments.read` is sufficient for detail without a separate sales-read grant. Stable request keys preserve retry safety; completed receipts cannot be edited or deleted. Amount Paid is paid receipts minus processed refunds; Remaining Balance is the remaining payable order value minus that net amount. Returns alone do not reverse money, cancellation and refunds are not counted twice, and a legacy negative balance remains visible as Overpaid. Successful mutations refresh related lists, detail, reports, and dashboard queries; errors keep form drafts available for correction or retry.

The current cash-order completion rule remains: fulfillment must be resolved and the balance paid. There are no invented due dates, overdue penalties, customer credit limits, new Project model, or automatic payment gateway transfers. GCash/Bank/Payroll choices record manual bookkeeping; payroll runs, salary calculations, cash-advance deductions, and external settlement are not implemented. Backend checks enforce permissions, branch scope, state transitions, and amount bounds even when a UI action is hidden.

## Private proof workflow

The shared `AttachmentList` and `ProofUploader` support `payment`, `vehicle-maintenance`, and `driver-allowance` parents. Payment proofs attach to an immutable **receipt ID**, not an order ID. Users can view/download only proofs permitted by the parent's real branch and domain grants; upload controls follow the server's additional action permissions and status rules.

The API lists/uploads at `/api/v1/attachments?entityType=...&entityId=...` and downloads from `/api/v1/attachments/:id/content`. Uploads send raw binary bytes, matching `Content-Type`, and a percent-encoded `x-file-name` header. JPEG, PNG, WebP, and PDF files up to 10 MiB are supported; the server checks filename/type/extension/format markers. The UI shows file metadata and protected downloads, never an object-storage key or public proof URL. Downloads require the current cookie session and return private/no-store attachment responses. Format validation is not malware scanning or identity verification.

For local development, the backend stores private files under `LOCAL_UPLOAD_DIR`, default `.local/private-uploads`, when R2 variables are unset. Files are not served as a public/static directory. Production requires a private configured R2 bucket; the backend fails closed rather than using local development storage. Actual credentialed R2 upload/download/failure/cleanup acceptance and backup/restore remain deployment work. The isolated browser runner verifies local private-storage behavior only.

## Main areas

- `src/app` — providers and route composition.
- `src/components` — shared UI and application components.
- `src/features` — authentication, dashboard, design-system, and business-module features.
- `src/features/users` — account detail, Users & Roles page state, and administration mutations.
- `src/features/fleet` — dedicated vehicle register, assignments, maintenance, detail, and transitions.
- `src/features/driver-allowances` — allowance forms, lifecycle actions, receipt acknowledgement, and detail.
- `src/features/customer-payments` — order receivables, immutable receipts, payment form, detail, and proof entry points.
- `src/components/common/AttachmentList.tsx` and `ProofUploader.tsx` — shared private proof UI.
- `src/services/api/client.ts` — centralized REST client.
- `src/features/modules/modules.ts` — module navigation and table metadata.

See [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) for the implemented architecture and [CBMS_FRONTEND.md](CBMS_FRONTEND.md) for the product and design requirements.

## Expenses and shared UI verification

Expenses now has dedicated authoritative detail, exact submission/retry identity, persisted review metadata, source-authorized private proof lists, paginated history and compact create/review forms. Its fields and actions preserve the existing expense approval policy. Shared mobile cards now expose the practical per-module business values; older forms reuse explicit labels and option loading/retry states, preserve drafts and guard pending dismissal. See `md-docs/archive/modules/expenses-2026-10-01.md` and `md-docs/archive/audits/ui-ux-2026-10-01.md` for evidence and remaining limits.

Focused browser checks use `npm run test:e2e -- expense-workflows.spec.ts` or `npm run test:e2e -- ui-system.spec.ts`; the full isolated runner remains `npm run test:e2e`.
