# CBMS Frontend Architecture & Design System

## Payroll feature ownership

Payroll has a dedicated feature under `src/features/payroll` for the regular compensation workflow. Keep salary/wage entries separate from the `driver-allowances` feature, whose records represent optional trip-related allowances, advances, and reimbursements. Payroll figures are period-entry snapshots; do not add an employee default rate or statutory calculation without approved business policy. The current workflow supports draft creation, processing, payment recording, receipt acknowledgement, and private proof; draft editing from the UI and payroll reports remain follow-up work.

## 1. Overview

The Construction Business Management System (CBMS) frontend serves employees, managers, administrators, and owners. It must be fast, accessible, responsive across desktop, tablet, and mobile, consistent across modules, and maintainable as the system grows.

Version 1 is an online-first internal business application. The backend owns authentication, authorization, business rules, database operations, file validation, and critical transactions. See [CBMS_BACKEND.md](../cbms-backend/CBMS_BACKEND.md).

This document consolidates the original architecture and subsequent design-system additions. The later approved component foundation and required light/dark themes supersede earlier optional wording.

## 2. Approved technology stack

| Purpose | Technology |
| --- | --- |
| Framework and language | React + TypeScript |
| Development and builds | Vite |
| Styling | Tailwind CSS; custom CSS when needed |
| Component foundation | shadcn/ui + Radix UI |
| Icons | Lucide React |
| Routing | React Router |
| Server state | TanStack Query |
| Reusable tables | TanStack Table + shadcn/ui Table |
| Forms and validation | React Hook Form + Zod |
| API | REST API through one Fetch or Axios client |
| Dates | date-fns |
| Charts | Recharts |
| Toasts | Sonner |
| Command interface | cmdk + shadcn Command, when needed |
| Code quality | ESLint; Prettier if desired |
| Testing | Component, integration, accessibility, and E2E tests; Playwright for E2E |

Use libraries where needed and avoid overlapping solutions. Prefer proper TypeScript interfaces and types over unnecessary `any`. Vite commands are `npm run dev` and `npm run build`.

## 3. Architecture and organization

Use a feature-based vertical slice structure. Each feature contains its own pages, components, hooks, API functions, schemas, types, and utilities. Keep components focused and split large pages into smaller compositions.

```text
cbms-frontend/
├── public/
├── src/
│   ├── app/                 # App.tsx and providers.tsx
│   ├── assets/
│   ├── components/
│   │   ├── ui/              # Primitives without business logic
│   │   ├── common/          # Shared application components
│   │   └── layout/          # Sidebar, Topbar, MobileNav, AppShell
│   ├── features/
│   │   └── inventory/
│   │       ├── api/inventory.api.ts
│   │       ├── components/
│   │       ├── hooks/useInventory.ts
│   │       ├── schemas/inventory.schema.ts
│   │       ├── types/inventory.types.ts
│   │       ├── utils/
│   │       └── pages/InventoryPage.tsx
│   ├── hooks/               # Shared hooks
│   ├── layouts/             # AuthLayout, AppLayout, AdminLayout as needed
│   ├── lib/                 # Query client, permissions, formatters, utilities
│   ├── routes/router.tsx
│   ├── services/api/client.ts
│   ├── types/               # Shared types
│   ├── main.tsx
│   └── index.css
├── tests/
├── .env.example
├── .gitignore
├── Dockerfile
├── eslint.config.js
├── package.json
├── tsconfig.json
└── vite.config.ts
```

Features cover auth, dashboard, users, roles/permissions, branches, employees, customers, suppliers, products/categories, inventory/transfers/adjustments, orders/sales, payments, deliveries, vehicles/drivers, expenses, payroll, reports, files/attachments, and audit logs. Notifications remain a separate feature when introduced.

Use PascalCase for custom component filenames, `use` prefixes for hooks, and descriptive utility names such as `formatCurrency.ts`. Keep existing library primitive filename conventions where appropriate.

## 4. Component reuse policy

Before creating UI, inspect shared primitives, common components, existing feature components, and the design-system page. Follow this order:

1. Reuse an existing component.
2. Extend it through props, variants, sizes, icons, or states.
3. Compose a feature-specific wrapper.
4. Create a new component only when existing components cannot solve the problem.

All modules use one CBMS design system. Prefer composition and variants over nearly identical components. Split abstractions that become difficult to understand; reusability should not produce an oversized universal component.

| Layer | Examples |
| --- | --- |
| `components/ui` | Button, IconButton, Input, Textarea, Select, Checkbox, RadioGroup, Switch, Dialog, Sheet, Popover, Tooltip, Tabs, Accordion, Card, Badge, Table, Skeleton, Separator, DropdownMenu, Command, Calendar |
| `components/common` | DataTable, PageHeader, SectionHeader, SearchInput, FilterBar, StatusBadge, ConfirmDialog, FileUploader, EmptyState, ErrorState, loading skeletons, PermissionGuard, BranchGuard, ProtectedAction, BranchSelector, DateRangePicker, CurrencyInput |
| `components/layout` | Sidebar, Topbar, MobileNav, application shell |
| Feature components | InventoryTable, InventoryFilters, StockAdjustmentDialog composed from shared UI |

Shared form controls cover text, textarea, select/searchable select, combobox, checkbox, switch, date/date-range, currency, number, and file upload. PageContainer, PageActions, and PageSection may provide shared page structure.

StatusBadge centrally defines labels, icons, styles, and accessibility text. ConfirmDialog accepts a title, consequence description, confirm/cancel labels, variant, handler, and loading state.

## 5. Routing, sessions, and permissions

React Router handles `/login`, `/dashboard`, `/users`, `/branches`, `/employees`, `/customers`, `/products`, `/inventory`, `/inventory/transfers`, `/orders`, `/deliveries`, `/payroll`, `/expenses`, `/reports`, `/audit-logs`, and `/settings`. Detail routes use identifiers, such as `/orders/:id`. Unknown routes show a useful 404 page with a return action; denied access shows a 403 state.

Track the authenticated user's ID, name, email, role, permissions, assigned branch, and session status. Prefer secure server-controlled sessions and HTTP-only cookies where appropriate. Handle expiration and logout, avoid unsafe long-term token storage, and clear stale authentication state before redirecting to login when a session expires.

Protect routes, navigation, and actions by authentication, permissions, and branch access. For example, `inventory.read` permits a read-only experience while `inventory.adjust` permits stock adjustments. Reuse permission guards.

**Frontend checks improve UX; the backend independently enforces permissions, branch access, validation, and business rules on every protected request.**

Always show the current branch. Cross-branch users may receive a branch selector or All Branches view; regular users cannot select unauthorized branches. Restrict audit interfaces to authorized users, showing activity, user, module, action, timestamp, and branch without unnecessary internal metadata.

## 6. API communication and state

Centralize base URL, credentials, headers, timeouts, authentication handling, response parsing, and errors in `services/api/client.ts`. Feature API functions live in their feature's `api/` directory and use this client.

```text
Page / user action → feature hook or form handler → TanStack Query
→ feature API function → shared client → Express REST API
→ response → query cache → updated UI
```

TanStack Query owns server data, caching, refetching, loading/error states, mutations, invalidation, and background refresh. Local React state handles dialogs, tabs, search input, temporary filters, dropdowns, and form UI.

Use global state only for shared authentication, theme, preferences, or sidebar state. Do not duplicate query-managed data in a global store. Consider Zustand only if necessary; Redux requires a concrete need.

Optimistic updates are suitable only for safe operations. Payments, payroll, inventory transactions, financial records, and critical approvals wait for backend confirmation. Show meaningful results and reference IDs for critical actions.

## 7. Forms, tables, and files

### Forms

Use React Hook Form with Zod for complex forms. Show required fields, validation/server errors, disabled/submitting states, and success feedback. Prevent duplicate submissions, preserve entered data after network failures, and consider unsaved-change warnings for long forms. Backend validation remains mandatory.

### Tables and filters

Build one DataTable with TanStack Table and shadcn/ui Table. Support pagination, sorting, filtering, search, loading/empty/error states, row actions, column visibility, selection, exports, and responsive behavior where appropriate. Features provide columns, filters, actions, data sources, and permissions.

Large datasets use backend pagination, search, filtering, and sorting rather than downloading all records. Example: `GET /api/v1/orders?page=1&limit=25&status=completed`.

Search labels explain searchable fields; debounce when useful. Keep active filters visible and provide Apply/Clear controls. Filters may include branch, status, date range, employee, category, supplier, and customer. Show result counts, Previous/Next controls, and suitable page sizes such as 10, 25, 50, or 100.

### Files, printing, and exports

FileUploader handles selection, drag-and-drop, previews, progress, removal, and errors. Features configure types and size limits according to backend restrictions; the backend validates uploads. Optimize images with appropriate dimensions, thumbnails, responsive sources, lazy loading, and placeholders.

Provide print-friendly invoices, order summaries, delivery documents, reports, and payroll documents where required. Exports may use CSV, Excel, or PDF. Large or business-critical exports are generated by the backend; the frontend shows download status.

## 8. Layout and user experience

Desktop uses a top navigation bar, sidebar, and main content. Mobile uses a header and drawer or another suitable navigation pattern. Support inventory checks, order viewing, delivery updates, notifications, and simple approvals on mobile. Tables may use horizontal scrolling, priority columns, cards, or responsive row details to remain readable.

Suggested navigation groups:

- Operations: Orders, Inventory, Deliveries.
- People: Employees, Customers, Suppliers.
- Finance: Expenses, Payroll.
- Management: Branches, Users, Roles, Reports, Audit Logs.
- Dashboard and Settings.

Use page headers with title, description, breadcrumbs for nested pages, and primary/secondary actions. Shared templates cover lists, details, and create/edit workflows.

| Dashboard role | Example content |
| --- | --- |
| Owner / administrator | Total sales, branch performance, expenses, inventory alerts, employee count, pending deliveries, recent activity |
| Branch manager | Branch sales/inventory, pending orders, deliveries, staff activity, low stock |
| Inventory staff | Low stock, recent stock changes, transfers, pending receipts |

Keep KPI cards concise; detailed analysis belongs in reports. Charts should clarify sales, expenses, branch comparisons, inventory movement, order volume, or payroll trends.

| UI state | Behavior |
| --- | --- |
| Loading | Shared skeletons, spinners, or messages; prefer skeleton rows for tables and disable pending actions |
| Empty | Explain missing records or unmatched filters and offer an appropriate action |
| Error | Plain-language explanation and retry/recovery action; technical details stay in logs |
| Unexpected render failure | React error boundary with a section/page fallback |
| Network failure | Explain the connection issue and preserve form data |
| Short confirmation | Toast; critical information remains available beyond a disappearing notification |
| Dangerous action | Confirm consequences, distinguish controls visually, and separate them from common actions |

Dangerous actions include cancelling orders, archiving employees, deleting attachments, resetting passwords, and adjusting inventory.

Use shared formatters for Philippine pesos (`₱1,250.00`), quantities (`1,250 items`, `25.5 kg`), and dates/times. Convert backend UTC timestamps to the appropriate local timezone and use consistent display formats.

## 9. Accessibility, security, and configuration

Use semantic HTML, keyboard navigation, visible focus states, labelled forms, accessible buttons/dialogs, appropriate ARIA, readable contrast, and screen-reader support. Statuses need text and a visual indicator; never rely on color alone. Use Radix primitives for complex interactive accessibility behavior.

Never include backend secrets, password hashes, private configuration, or credentials in frontend code, API responses, or browser storage. Do not build SQL queries or expose stack traces. Avoid `dangerouslySetInnerHTML`; sanitize HTML if rendering it is necessary.

Browser storage may hold harmless preferences such as theme, sidebar collapse, and table density. Avoid highly sensitive data in localStorage/sessionStorage. Frontend environment variables are public and contain only non-secret configuration:

```env
VITE_API_URL=
VITE_APP_NAME=
VITE_ENVIRONMENT=
```

Provide `.env.example`; never commit real secrets, private credentials, or `node_modules`.

## 10. Performance and testing

Use route/code splitting, lazy loading, query caching, optimized images, pagination, tree shaking, and memoization where evidence justifies it. Large areas such as payroll, reports, inventory, and administration can load separately. Avoid premature optimization.

Prioritize component, integration, accessibility, and E2E verification of login/logout, route protection, permission visibility, branch access, orders, inventory adjustments/transfers, employee management, payroll, validation, and session expiration. A representative Playwright flow logs in as a branch manager, adjusts an authorized product, confirms the action, and verifies updated inventory.

## 11. Future additions and exclusions

Version 1 does not require Redux, Next.js, GraphQL, micro-frontends, complex animation libraries, multiple CSS frameworks, offline synchronization, or native mobile apps. The internal authenticated application does not initially require public SEO, server rendering, or static generation; React and Vite remain the foundation.

A PWA, push notifications, limited offline support, or native app may be considered when workflows justify them. Offline synchronization requires resolving inventory conflicts, duplicate orders, payment conflicts, stale data, and authorization issues.

A future notification center may show low inventory, pending approvals, delivery updates, payroll alerts, and announcements. Keep it within its own feature.

## 12. Design system and themes

Use a clean, professional, business-focused style and one main UI font such as Inter, Geist, or Roboto. Define typography, spacing, sizing, radius, shadows, focus states, breakpoints, and component variants/states centrally. Keep animation subtle, mainly for drawers, dialogs, dropdowns, and loading indicators.

Light and dark modes are required. System-theme support may be added later. Use the palette and semantic tokens below with the same reusable components in both themes. Preserve readable contrast, tables/forms, status clarity, and accessibility.
### Official CBMS Brand Palette

The official CBMS brand colors are:

```
Primary Blue
RGB: rgb(37, 60, 109)
HEX: #253C6D
Construction Orange
RGB: rgb(242, 132, 47)
HEX: #F2842F
Light Neutral
RGB: rgb(242, 242, 242)
HEX: #F2F2F2
```

These three colors are the foundation of the CBMS visual identity.

Do not replace the primary brand colors without updating the design system.

---

### Brand Color Usage

#### Primary Blue

```
rgb(37, 60, 109)
#253C6D
```

Recommended uses:

```
Primary buttons
Sidebar
Navigation highlights
Links
Active states
Focus states
Brand elements
Selected tabs
Important headings
```

---

#### Construction Orange

```
rgb(242, 132, 47)
#F2842F
```

Recommended uses:

```
Accent actions
Important highlights
Active indicators
Notifications
Selected values
Charts
Call-to-action emphasis
Brand details
```

Orange should normally be used as an accent rather than covering large areas of the interface.

---

#### Light Neutral

```
rgb(242, 242, 242)
#F2F2F2
```

Recommended uses:

```
Application background
Muted surfaces
Secondary panels
Table backgrounds
Input backgrounds
Disabled states
Section backgrounds
```

---

### Light Mode

The base light-mode palette should use the official brand colors with semantic supporting colors.

```
Background
#F2F2F2
rgb(242, 242, 242)
Surface
#FFFFFF
rgb(255, 255, 255)
Surface Secondary
#F8F8F8
rgb(248, 248, 248)
Primary
#253C6D
rgb(37, 60, 109)
Primary Hover
#1D315C
rgb(29, 49, 92)
Primary Active
#17284D
rgb(23, 40, 77)
Primary Foreground
#FFFFFF
Accent
#F2842F
rgb(242, 132, 47)
Accent Hover
#DD7323
rgb(221, 115, 35)
Accent Active
#C9631C
rgb(201, 99, 28)
Accent Foreground
#FFFFFF
Text Primary
#172033
Text Secondary
#5F687A
Text Muted
#808898
Border
#D9DDE5
Border Strong
#B9C0CD
Input Background
#FFFFFF
Focus Ring
#253C6D
```

---

### Dark Mode

Dark mode must keep the same CBMS identity.

The interface should not simply invert the light theme.

Dark mode should use dark navy surfaces while preserving the official blue and orange brand colors.

Recommended dark palette:

```
Background
#0D1424
rgb(13, 20, 36)
Surface
#141D31
rgb(20, 29, 49)
Surface Secondary
#1A2540
rgb(26, 37, 64)
Elevated Surface
#202D4B
rgb(32, 45, 75)
Primary
#4D6BA8
rgb(77, 107, 168)
Primary Brand
#253C6D
rgb(37, 60, 109)
Primary Hover
#5D7AB6
Primary Active
#6C89C5
Primary Foreground
#FFFFFF
Accent
#F2842F
rgb(242, 132, 47)
Accent Hover
#F49349
Accent Active
#FFA15C
Accent Foreground
#111827
Text Primary
#F2F2F2
rgb(242, 242, 242)
Text Secondary
#B8C0D0
Text Muted
#8993A7
Border
#2B3853
Border Strong
#3A4968
Input Background
#172136
Focus Ring
#F2842F
```

The original brand blue remains part of the dark-mode identity, while a lighter blue variation may be used for interactive elements so they remain visible against dark backgrounds.

---

### Semantic Colors

Business status colors must remain separate from brand colors.

#### Success

```
Light Mode
#16803A
Dark Mode
#4ADE80
```

Used for:

```
Completed
Paid
Active
Successful
Available
Approved
```

---

#### Warning

```
Light Mode
#D97706
Dark Mode
#FBBF24
```

Used for:

```
Pending
Low stock
Needs attention
Approaching deadline
```

Do not confuse warning yellow/amber with the CBMS brand orange.

---

#### Danger

```
Light Mode
#DC2626
Dark Mode
#F87171
```

Used for:

```
Delete
Cancel
Failed
Rejected
Overdue
Critical
Out of stock
```

---

#### Information

```
Light Mode
#2563EB
Dark Mode
#60A5FA
```

Used for:

```
Information
Neutral notices
Help messages
Processing states
```

---

### Semantic Design Tokens

Components should use semantic tokens instead of hardcoded colors.

Use tokens such as:

```
background
foreground
card
card-foreground
popover
popover-foreground
primary
primary-foreground
secondary
secondary-foreground
accent
accent-foreground
muted
muted-foreground
border
input
ring
success
success-foreground
warning
warning-foreground
destructive
destructive-foreground
info
info-foreground
```

Components should reference these tokens.

Bad:

```
className="bg-[#253C6D]"
```

Preferred:

```
className="bg-primary"
```

This makes light and dark mode easier to manage.

---

### Tailwind / shadcn Theme Strategy

The palette should be integrated into:

```
Tailwind CSS
+
shadcn/ui
+
CSS variables
```

Example conceptual structure:

```
:root {
  --background: ...;
  --foreground: ...;
  --primary: ...;
  --primary-foreground: ...;
  --accent: ...;
  --accent-foreground: ...;
  --card: ...;
  --card-foreground: ...;
  --border: ...;
  --input: ...;
  --ring: ...;
}
.dark {
  --background: ...;
  --foreground: ...;
  --primary: ...;
  --primary-foreground: ...;
  --accent: ...;
  --accent-foreground: ...;
  --card: ...;
  --card-foreground: ...;
  --border: ...;
  --input: ...;
  --ring: ...;
}
```

Exact implementation values should follow the design tokens defined above.

---

### Theme Rules

CBMS must support:

```
Light Mode
Dark Mode
```

Optional later:

```
System Theme
```

Theme switching must affect reusable components globally.

Do not create separate light and dark versions of every component.

Correct:

```
One Button component
+
Theme tokens
```

Incorrect:

```
LightButton.tsx
DarkButton.tsx
```

---


## 13. Component design reference page

The checklist below belongs to a dedicated development/design page at `/design-system` or `/dev/components`, normally unavailable to regular production users. It is the visual source of truth for reusable components.

Attach designs or screenshots to the corresponding sections and display each approved reference beside or above its implementation. Follow approved designs; accessibility and responsive adjustments should preserve their visual intent.

Approval workflow: attach reference → review behavior → implement → test light mode → test dark mode → test responsive behavior → test accessibility → approve → reuse across CBMS.

All 40 original reference sections and attachment placeholders are retained. This is a review catalog; optional features remain subject to Section 11.

### 01 — Brand

```text
[ ATTACH CBMS LOGO DESIGN HERE ]
[ ATTACH LIGHT MODE BRAND REFERENCE HERE ]
[ ATTACH DARK MODE BRAND REFERENCE HERE ]
```

Show:

```text
Logo
Primary Blue
Construction Orange
Light Neutral
Light Mode Colors
Dark Mode Colors
Typography
Spacing
Border Radius
Shadows
```

### 02 — Typography

```text
[ ATTACH TYPOGRAPHY DESIGN HERE ]
```

Show:

```text
Display
H1
H2
H3
H4
H5
H6
Body Large
Body
Body Small
Label
Caption
Muted Text
Link
```

### 03 — Buttons

```text
[ ATTACH BUTTON DESIGN HERE ]
```

Show:

```text
Primary Button
Secondary Button
Accent Button
Outline Button
Ghost Button
Destructive Button
Link Button
Icon Button
```

States:

```text
Default
Hover
Active
Focus
Disabled
Loading
```

Sizes:

```text
Small
Medium
Large
Icon
```

### 04 — Inputs

```text
[ ATTACH INPUT DESIGN HERE ]
```

Show:

```text
Text Input
Number Input
Currency Input
Password Input
Search Input
Textarea
```

States:

```text
Default
Focus
Filled
Disabled
Error
Success
```

### 05 — Selects & Comboboxes

```text
[ ATTACH SELECT / COMBOBOX DESIGN HERE ]
```

Show:

```text
Select
Multi Select
Combobox
Searchable Select
Branch Selector
Status Selector
```

### 06 — Checkbox / Radio / Switch

```text
[ ATTACH SELECTION CONTROL DESIGN HERE ]
```

Show:

```text
Checkbox
Radio Button
Radio Group
Switch
```

States:

```text
Default
Selected
Focus
Disabled
```

### 07 — Date Components

```text
[ ATTACH DATE COMPONENT DESIGN HERE ]
```

Show:

```text
Date Picker
Date Range Picker
Calendar
Month Picker
Time Picker
```

### 08 — Cards

```text
[ ATTACH CARD DESIGN HERE ]
```

Show:

```text
Basic Card
Stat Card
Info Card
Dashboard Card
Clickable Card
Warning Card
```

### 09 — Tables

```text
[ ATTACH TABLE DESIGN HERE ]
```

Show:

```text
DataTable
Table Header
Table Row
Table Cell
Selected Row
Expandable Row
Row Actions
Column Sorting
Column Visibility
```

Also show:

```text
Loading Table
Empty Table
Error Table
```

### 10 — Filters

```text
[ ATTACH FILTER DESIGN HERE ]
```

Show:

```text
Filter Bar
Search
Branch Filter
Status Filter
Date Filter
Category Filter
Clear Filters
```

### 11 — Pagination

```text
[ ATTACH PAGINATION DESIGN HERE ]
```

Show:

```text
Previous
Page Numbers
Next
Rows Per Page
Result Count
```

### 12 — Badges & Status

```text
[ ATTACH BADGE / STATUS DESIGN HERE ]
```

Show:

```text
Default Badge
Primary Badge
Accent Badge
Success Badge
Warning Badge
Danger Badge
Info Badge
```

Status examples:

```text
Active
Inactive
Pending
Approved
Rejected
Paid
Unpaid
Completed
Cancelled
Low Stock
Out of Stock
```

### 13 — Dialogs / Modals

```text
[ ATTACH MODAL DESIGN HERE ]
```

Show:

```text
Basic Dialog
Form Dialog
Confirmation Dialog
Destructive Confirmation
Large Modal
```

### 14 — Drawers / Sheets

```text
[ ATTACH DRAWER / SHEET DESIGN HERE ]
```

Show:

```text
Right Sheet
Left Sheet
Mobile Navigation Drawer
Filter Drawer
```

### 15 — Dropdowns

```text
[ ATTACH DROPDOWN DESIGN HERE ]
```

Show:

```text
Dropdown Menu
Action Menu
Profile Menu
Context Menu
```

### 16 — Tabs

```text
[ ATTACH TAB DESIGN HERE ]
```

Show:

```text
Horizontal Tabs
Tabs with Icons
Tabs with Counters
```

### 17 — Breadcrumbs

```text
[ ATTACH BREADCRUMB DESIGN HERE ]
```

Example:

```text
Inventory
/
Products
/
Product Details
```

### 18 — Sidebar

```text
[ ATTACH SIDEBAR DESIGN HERE ]
```

Show:

```text
Expanded Sidebar
Collapsed Sidebar
Active Item
Nested Navigation
Section Labels
User Profile Area
```

Provide both:

```text
Light Mode
Dark Mode
```

### 19 — Top Navigation

```text
[ ATTACH TOPBAR DESIGN HERE ]
```

Show:

```text
Logo / Page Context
Search
Branch Selector
Notifications
Theme Toggle
User Menu
```

### 20 — Mobile Navigation

```text
[ ATTACH MOBILE NAVIGATION DESIGN HERE ]
```

Show:

```text
Mobile Header
Menu Button
Navigation Drawer
User Actions
```

### 21 — Page Header

```text
[ ATTACH PAGE HEADER DESIGN HERE ]
```

Show:

```text
Title
Description
Breadcrumb
Primary Action
Secondary Action
```

Example:

```text
Inventory
Manage inventory and stock movements.
[Export] [Add Product]
```

### 22 — Empty State

```text
[ ATTACH EMPTY STATE DESIGN HERE ]
```

Show:

```text
Icon / Illustration
Title
Description
Primary Action
Optional Secondary Action
```

### 23 — Error State

```text
[ ATTACH ERROR STATE DESIGN HERE ]
```

Show:

```text
Page Error
Component Error
Network Error
403
404
500
```

### 24 — Loading State

```text
[ ATTACH LOADING STATE DESIGN HERE ]
```

Show:

```text
Page Skeleton
Card Skeleton
Table Skeleton
Form Skeleton
Button Loading
```

### 25 — Toasts

```text
[ ATTACH TOAST DESIGN HERE ]
```

Show:

```text
Success
Error
Warning
Info
Loading
```

Recommended foundation:

```text
Sonner
```

### 26 — Alerts

```text
[ ATTACH ALERT DESIGN HERE ]
```

Show:

```text
Information
Success
Warning
Danger
```

### 27 — Tooltips

```text
[ ATTACH TOOLTIP DESIGN HERE ]
```

Show:

```text
Text Tooltip
Icon Tooltip
Disabled Action Explanation
```

### 28 — File Upload

```text
[ ATTACH FILE UPLOAD DESIGN HERE ]
```

Show:

```text
Upload Area
Drag and Drop
Selected File
Uploading
Uploaded
Upload Error
Image Preview
Document Preview
```

### 29 — Avatars

```text
[ ATTACH AVATAR DESIGN HERE ]
```

Show:

```text
Image Avatar
Initial Avatar
User Avatar
Avatar Group
```

### 30 — Dashboard Components

```text
[ ATTACH DASHBOARD COMPONENT DESIGN HERE ]
```

Show:

```text
KPI Card
Trend Card
Mini Chart
Activity Card
Summary Card
Low Stock Card
Pending Task Card
```

### 31 — Charts

```text
[ ATTACH CHART DESIGN HERE ]
```

Show:

```text
Line Chart
Bar Chart
Area Chart
Donut Chart
Legend
Tooltip
```

Recommended:

```text
Recharts
```

Charts should follow the CBMS palette.

Suggested chart sequence:

```text
#253C6D
#F2842F
#4D6BA8
#F5A15D
```

plus semantic colors when appropriate.

### 32 — Search

```text
[ ATTACH SEARCH DESIGN HERE ]
```

Show:

```text
Simple Search
Table Search
Command Search
Global Search
Search Results
```

### 33 — Command Palette

```text
[ ATTACH COMMAND PALETTE DESIGN HERE ]
```

Potential implementation:

```text
cmdk
+
shadcn Command
```

### 34 — Notifications

```text
[ ATTACH NOTIFICATION DESIGN HERE ]
```

Show:

```text
Notification Button
Unread Count
Notification List
Read Notification
Unread Notification
Notification Empty State
```

### 35 — Form Layout

```text
[ ATTACH FORM PAGE DESIGN HERE ]
```

Show:

```text
Simple Form
Two Column Form
Form Sections
Required Fields
Validation Errors
Submit Area
```

### 36 — Login Page

```text
[ ATTACH LOGIN PAGE DESIGN HERE ]
```

Show:

```text
Logo
Email / Username
Password
Remember Me if required
Login Button
Error Message
```

Provide:

```text
Light Mode
Dark Mode
```

### 37 — Dashboard Layout

```text
[ ATTACH DASHBOARD PAGE DESIGN HERE ]
```

Show:

```text
Sidebar
Topbar
Page Header
KPI Cards
Charts
Recent Activity
Tables
```

### 38 — Table Page Template

```text
[ ATTACH TABLE PAGE DESIGN HERE ]
```

Example:

```text
Page Header
Search / Filters
Primary Action
Data Table
Pagination
```

This template can be reused for:

```text
Users
Employees
Customers
Suppliers
Products
Orders
Deliveries
Expenses
Payroll
Audit Logs
```

### 39 — Detail Page Template

```text
[ ATTACH DETAIL PAGE DESIGN HERE ]
```

Show:

```text
Breadcrumbs
Title
Status
Actions
Summary
Tabs
Activity / History
```

### 40 — Create / Edit Page Template

```text
[ ATTACH CREATE / EDIT PAGE DESIGN HERE ]
```

Show:

```text
Page Header
Form Sections
Save
Cancel
Validation
Unsaved Changes Warning
```




# 41 — Stepper / Multi-Step Workflow

```text
[ ATTACH STEPPER / MULTI-STEP WORKFLOW DESIGN HERE ]
```

Show:

```text
Horizontal Stepper

Vertical Stepper

Current Step

Completed Step

Upcoming Step

Error Step

Disabled Step
```

Possible CBMS uses:

```text
Employee onboarding

Inventory transfer

Order processing

Delivery workflow

Payroll processing

Approval workflow
```

Example workflow:

```text
Draft
↓
Review
↓
Approved
↓
Processing
↓
Completed
```

---

# 42 — Progress Indicators

```text
[ ATTACH PROGRESS INDICATOR DESIGN HERE ]
```

Show:

```text
Progress Bar

Circular Progress

Indeterminate Progress

Upload Progress

Task Progress

Percentage Progress
```

Examples:

```text
45% uploaded

3 of 5 steps complete

Generating report...
```

Avoid using progress indicators when the operation completes almost instantly.

---

# 43 — Trend Indicators

```text
[ ATTACH TREND INDICATOR DESIGN HERE ]
```

Show:

```text
Positive Trend

Negative Trend

Neutral Trend

Percentage Change

Absolute Change
```

Example:

```text
Total Sales

₱250,000

+8.4% vs previous month
```

Trend indicators must not rely only on color.

Use:

```text
Icon
+
Value
+
Label
```

---

# 44 — Inline Form Messages

```text
[ ATTACH INLINE FORM MESSAGE DESIGN HERE ]
```

Show:

```text
Helper Text

Required Message

Validation Error

Validation Success

Warning Message

Information Message
```

Example:

```text
Password

Must contain at least 8 characters.
```

Error:

```text
Email address is required.
```

Warnings should not use destructive styling unless the condition is actually critical.

---

# 45 — Bulk Action Bar

```text
[ ATTACH BULK ACTION BAR DESIGN HERE ]
```

Show:

```text
Selected Row Count

Primary Bulk Action

Secondary Bulk Action

Destructive Bulk Action

Clear Selection
```

Example:

```text
12 employees selected

[Export]
[Assign Branch]
[Deactivate]
[Clear]
```

Bulk actions should only appear when one or more records are selected.

---

# 46 — Table Density

```text
[ ATTACH TABLE DENSITY DESIGN HERE ]
```

Show:

```text
Comfortable

Default

Compact
```

Recommended behavior:

```text
Comfortable
→ dashboards and simple lists

Default
→ normal CBMS tables

Compact
→ high-density administrative tables
```

Density should change spacing, not remove required information.

---

# 47 — Advanced Table Columns

```text
[ ATTACH ADVANCED TABLE COLUMN DESIGN HERE ]
```

Show:

```text
Sticky Header

Sticky First Column

Resizable Columns

Reorderable Columns

Column Visibility

Pinned Actions Column
```

Use advanced table behavior only when it improves productivity.

Do not make every small table unnecessarily complex.

---

# 48 — Timeline / Activity History

```text
[ ATTACH TIMELINE / ACTIVITY HISTORY DESIGN HERE ]
```

Show:

```text
Timestamp

Actor

Action

Description

Status

Optional Icon

Optional Metadata
```

Possible uses:

```text
Order history

Delivery history

Inventory movement history

Employee history

Approval history

Audit history
```

Example:

```text
10:32 AM

Juan Dela Cruz

Inventory adjusted

+25 bags of cement added
```

---

# 49 — Description List / Key-Value Information

```text
[ ATTACH DESCRIPTION LIST DESIGN HERE ]
```

Show:

```text
Label

Value

Optional Icon

Optional Copy Action

Optional Status
```

Example:

```text
Order Number
ORD-2026-00125

Customer
ABC Construction

Branch
Main Branch

Status
Processing
```

This component is useful for detail pages.

---

# 50 — Attachment List

```text
[ ATTACH ATTACHMENT LIST DESIGN HERE ]
```

Show:

```text
File Icon

File Name

File Type

File Size

Uploaded By

Upload Date

Preview

Download

Remove
```

Possible file states:

```text
Available

Uploading

Failed

Unavailable

Restricted
```

This is separate from the FileUploader component.

The uploader handles new files.

The attachment list handles already-uploaded files.

---

# 51 — Entity Picker

```text
[ ATTACH ENTITY PICKER DESIGN HERE ]
```

Show:

```text
Employee Picker

Customer Picker

Supplier Picker

Product Picker

Driver Picker

Vehicle Picker
```

Recommended capabilities:

```text
Search

Keyboard Navigation

Loading State

Empty State

Selected Entity

Clear Selection
```

For large datasets, entity pickers should use backend search rather than loading every record.

---

# 52 — System Banner

```text
[ ATTACH SYSTEM BANNER DESIGN HERE ]
```

Show:

```text
Information Banner

Warning Banner

Maintenance Banner

Critical Banner

Dismissible Banner

Persistent Banner
```

Possible uses:

```text
Scheduled maintenance

Temporary system issue

Business announcement

Important policy change

Service degradation
```

Do not use banners for ordinary success messages.

---

# 53 — Workflow Status

```text
[ ATTACH WORKFLOW STATUS DESIGN HERE ]
```

Show:

```text
Draft

Submitted

Pending Review

Approved

Rejected

Processing

Completed

Cancelled
```

Possible representations:

```text
Status Badge

Stepper

Timeline

Status Header
```

Use the same status terminology consistently across the system.

---

# 54 — Print Layout

```text
[ ATTACH PRINT LAYOUT DESIGN HERE ]
```

Show:

```text
Company Header

Document Title

Reference Number

Customer / Employee Information

Line Items

Totals

Signatures

Notes

Footer
```

Create references for:

```text
Invoice

Order Summary

Delivery Document

Payroll Document

Report

Receipt
```

Print views should remove unnecessary application navigation.

Avoid printing:

```text
Sidebar

Topbar

Interactive buttons

Dropdowns

Search fields
```

unless specifically required.

---

# 55 — Responsive Component Reference

```text
[ ATTACH RESPONSIVE COMPONENT DESIGN HERE ]
```

Show the same component at:

```text
Desktop

Tablet

Mobile
```

Include references for:

```text
Sidebar

Top Navigation

DataTable

Cards

Forms

Dialogs

Filters

Page Header

Dashboard

Detail Page
```

Responsive behavior should be designed intentionally rather than relying only on automatic shrinking.

---

# 56 — Breakpoint Reference

```text
[ ATTACH BREAKPOINT REFERENCE HERE ]
```

Define the intended behavior for:

```text
Mobile

Tablet

Small Desktop

Large Desktop
```

Follow Tailwind breakpoints unless the project has a justified custom requirement.

Document:

```text
Navigation behavior

Grid columns

Card layout

Table behavior

Dialog width

Page padding

Form columns

Typography scaling
```

---

# 57 — Loading Overlay / Blocking Operation

```text
[ ATTACH BLOCKING OPERATION DESIGN HERE ]
```

Show:

```text
Page Blocking Loading

Dialog Blocking Loading

Form Processing State

Critical Operation Processing
```

Possible uses:

```text
Processing payroll

Submitting stock transfer

Finalizing order

Generating critical report
```

Avoid blocking the entire page for ordinary background queries.

---

# 58 — Copy-To-Clipboard

```text
[ ATTACH COPY ACTION DESIGN HERE ]
```

Show:

```text
Copy Icon

Copied State

Tooltip

Optional Toast
```

Possible uses:

```text
Order reference

Transaction ID

Employee ID

Email

Phone

Tracking reference
```

---

# 59 — Overflow / Truncated Content

```text
[ ATTACH TRUNCATED CONTENT DESIGN HERE ]
```

Show:

```text
Single-Line Truncation

Multi-Line Truncation

Tooltip Expansion

View More

Expandable Content
```

Useful for:

```text
Long addresses

Notes

Product descriptions

Audit descriptions

File names
```

Do not allow long content to break table layouts.

---

# 60 — Sensitive Value Display

```text
[ ATTACH SENSITIVE VALUE DISPLAY DESIGN HERE ]
```

Show:

```text
Hidden Value

Reveal Action

Copy Action

Permission Restricted State
```

Potential uses:

```text
Employee identifiers

Sensitive financial references

Private contact information

Restricted internal information
```

Do not use this component to expose values the backend should never send.

---

# 61 — Approval Actions

```text
[ ATTACH APPROVAL ACTION DESIGN HERE ]
```

Show:

```text
Approve

Reject

Request Changes

Add Comment

Approval History
```

Possible uses:

```text
Inventory adjustment approval

Expense approval

Payroll approval

Order approval

Administrative requests
```

Reject actions should normally request a reason when appropriate.

---

# 62 — Comment / Notes Section

```text
[ ATTACH COMMENTS / NOTES DESIGN HERE ]
```

Show:

```text
Add Note

Comment List

Author

Timestamp

Edited State

Internal Note

Optional Mention
```

Possible uses:

```text
Orders

Employees

Deliveries

Expenses

Approvals
```

Clearly distinguish internal notes from customer-visible information.

---

# 63 — Activity / Audit Diff

```text
[ ATTACH CHANGE DIFF DESIGN HERE ]
```

Show:

```text
Previous Value

New Value

Changed Fields

Changed By

Timestamp
```

Example:

```text
Unit Price

Before:
₱250.00

After:
₱275.00
```

This can be used for authorized audit and history views.

---

# 64 — KPI / Metric Grid

```text
[ ATTACH KPI GRID DESIGN HERE ]
```

Show:

```text
1 Card

2 Card Grid

3 Card Grid

4 Card Grid

Responsive Mobile Stack
```

Standardize:

```text
Metric Label

Metric Value

Trend

Supporting Text

Optional Icon
```

Avoid creating different KPI-card layouts on every dashboard.

---

# 65 — Dashboard Widget Container

```text
[ ATTACH DASHBOARD WIDGET CONTAINER DESIGN HERE ]
```

Show:

```text
Widget Title

Description

Action Menu

Refresh

Loading State

Empty State

Error State

Content Area
```

Charts, tables, lists, and activity feeds should be able to reuse this container.

---

# 66 — Data Refresh State

```text
[ ATTACH DATA REFRESH DESIGN HERE ]
```

Show:

```text
Last Updated

Refreshing

Refresh Button

Stale Data Warning

Refresh Failed
```

Example:

```text
Last updated 2 minutes ago
```

Useful for dashboards and operational pages.

---

# 67 — Offline / Connection Status

Version 1 remains online-first, but the UI should still communicate connection problems clearly.

```text
[ ATTACH CONNECTION STATUS DESIGN HERE ]
```

Show:

```text
Offline

Reconnecting

Connection Restored

Server Unavailable
```

This is a status indicator, not full offline synchronization.

---

# 68 — Keyboard Shortcut Hints

```text
[ ATTACH KEYBOARD SHORTCUT DESIGN HERE ]
```

Show:

```text
Shortcut Badge

Tooltip Shortcut

Command Palette Shortcut
```

Examples:

```text
Ctrl + K
Search

Esc
Close

Enter
Confirm
```

Only introduce shortcuts that are useful and do not interfere with browser accessibility.

---

# 69 — Icon Usage Reference

```text
[ ATTACH ICON USAGE DESIGN HERE ]
```

Define:

```text
Default Icon Size

Small Icon

Large Icon

Icon + Text

Icon Button

Status Icon

Decorative Icon
```

Use Lucide React consistently.

Avoid mixing multiple unrelated icon styles.

---

# 70 — Spacing Reference

```text
[ ATTACH SPACING REFERENCE HERE ]
```

Document common spacing patterns:

```text
Page Padding

Section Gap

Card Padding

Form Gap

Field Gap

Button Gap

Table Cell Padding

Dialog Padding
```

Spacing should come from the Tailwind scale or approved design tokens.

---

# 71 — Border Radius Reference

```text
[ ATTACH BORDER RADIUS DESIGN HERE ]
```

Define:

```text
Small Radius

Default Radius

Large Radius

Full Radius
```

Use consistent radii for:

```text
Buttons

Inputs

Cards

Dialogs

Badges
```

Do not randomly change corner radius between modules.

---

# 72 — Shadow / Elevation Reference

```text
[ ATTACH SHADOW / ELEVATION DESIGN HERE ]
```

Define:

```text
No Elevation

Low Elevation

Medium Elevation

High Elevation
```

Possible usage:

```text
Cards

Dropdowns

Dialogs

Popover

Floating controls
```

Dark mode shadows should be tested separately.

---

# 73 — Focus State Reference

```text
[ ATTACH FOCUS STATE DESIGN HERE ]
```

Show keyboard focus on:

```text
Button

Input

Select

Checkbox

Link

Tab

Menu Item

Table Action
```

Focus must remain clearly visible in light and dark modes.

Do not remove browser focus without replacing it with an accessible focus indicator.

---

# 74 — Disabled State Reference

```text
[ ATTACH DISABLED STATE DESIGN HERE ]
```

Show:

```text
Disabled Button

Disabled Input

Disabled Select

Disabled Checkbox

Disabled Tab

Disabled Action
```

Disabled controls should remain readable but clearly unavailable.

Where useful, explain why an action is disabled using a tooltip or helper text.

---

# 75 — Hover / Active Interaction Reference

```text
[ ATTACH INTERACTION STATE DESIGN HERE ]
```

Show:

```text
Default

Hover

Pressed / Active

Selected

Focus

Disabled
```

Provide examples for:

```text
Buttons

Navigation

Cards

Table rows

Dropdown items

Tabs
```

This section ensures all interactions feel consistent.

---

# Updated Component Design Reference Count

The CBMS design-system page now contains:

```text
75 reference sections
```

covering:

```text
Branding
Typography
Controls
Forms
Tables
Navigation
Feedback
Files
Dashboard
Charts
Layouts
Workflows
Approvals
Activity
Print
Responsive behavior
Accessibility states
Interaction states
Design tokens
```

---

# Final Design-System Rule

A reusable component is considered ready for application-wide use only when it has been checked for:

```text
Approved visual design

Light mode

Dark mode

Desktop

Tablet

Mobile

Keyboard access

Focus state

Hover state

Active state

Disabled state

Loading state where applicable

Error state where applicable

Accessibility

Permission behavior where applicable
```

The `/design-system` page remains the main visual reference for reusable frontend components.

When a component design is approved there, feature modules should reuse that component instead of implementing visually different alternatives.
