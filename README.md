# GSU Campus Food Ordering & Delivery System

Implementation scaffold matching the architecture defined in Chapter Three
(System Analysis and Design) of the final year project.

## Stack

- **Frontend:** HTML5, CSS3, Bootstrap 5, vanilla JavaScript (Fetch API) — no framework, no build step.
- **Backend:** Node.js + Express.js, organized in a Clean Architecture-inspired layered structure.
- **Database:** MySQL, accessed via `mysql2` with parameterized queries only.
- **Auth:** JWT (`jsonwebtoken`) + RBAC middleware.
- **Payment:** Paystack / Flutterwave (webhook-verified, not client-callback-trusted).

## Folder structure

```
src/
  config/         # DB pool, environment-derived config
  routes/         # Express routers — HTTP endpoint definitions only
  controllers/    # Translates req/res <-> service calls; no business logic
  services/       # Business rules (the "domain" layer) — no Express code
  repositories/   # The ONLY layer allowed to write SQL, one file per entity
  middleware/      # auth (JWT+RBAC), error handling, validation helpers
  utils/          # Pure helper functions
  app.js          # Express app assembly (middleware pipeline)
  server.js       # Entry point — starts the HTTP server

public/
  student/        # Student & staff UI (shared views, since both order food)
  vendor/         # Vendor menu & order management UI
  rider/          # Delivery rider UI
  admin/          # Administrator dashboard UI
  shared/         # Login/register pages + shared CSS/JS (apiClient.js, authGuard.js)

database/
  migrations/     # SQL schema migrations, run in order (001_ through 009_)
  seeds/          # Reference/sample data (e.g. baseline menu categories)
  migrate.js      # Runs pending migrations, tracked in a schema_migrations table
  seed.js         # Runs seed files (safe to re-run)

docs/
  fig3_1_architecture.png   # Chapter 3 diagrams, kept here for reference
  fig3_2_usecase.png        # while implementing each module — these are
  fig3_3_er.png              # the source of truth for table/field names,
  fig3_4_class.png           # relationships, and the order/payment flow.
  fig3_5_sequence.png
  fig3_6_activity.png

tests/
  unit/           # Service-layer tests (no DB, no HTTP — pure logic)
  integration/    # Route-level tests against a test DB
```

## Why this layering (for defense reference)

This mirrors Chapter 3, Section 3.2 (Clean Architecture) and Section 3.8.1
(System Architecture):

- **Repositories** isolate all SQL. If the database were ever swapped, only
  this layer changes — services and controllers are untouched.
- **Services** hold business rules and never import `express`. They can be
  unit tested without a running server or database mock beyond the repository.
- **Controllers** are deliberately thin — they only validate input shape,
  call a service, and shape the HTTP response.
- **Routes** declare *what* is exposed and *which roles* can access it
  (via `authorize()`), giving a single place to audit access control — a
  direct, visual answer to "how do you enforce FR10 (RBAC)?" in defense.

## Current status

- [x] Project scaffold
- [x] Auth module (register, login, JWT issuance) — full vertical slice
- [x] JWT + RBAC middleware
- [x] Centralized error handling
- [x] Frontend shared API client + login page
- [x] Database schema/migrations (9 tables, matching Chapter 3 Fig. 3.3 exactly)
- [x] Menu management module (vendor) — full CRUD, FR2
- [x] Cart & order placement module (student/staff) — FR3, transactional order creation, single-vendor cart enforced, server-authoritative pricing
- [x] Payment integration module (Paystack + webhook) — FR4, server-verified, idempotent, multi-attempt history
- [x] Delivery tracking module (rider) — FR5, FR6, FR7 built together; pull-based self-claim, atomic to prevent double-assignment
- [x] Admin dashboard & analytics module — FR9, vendor creation now admin-only
- [x] Reviews module — FR8, immutable, vendor rating aggregate on browse page

## Database schema

Nine tables, applied in this order (each migration file is numbered to
enforce it, since later tables have foreign keys into earlier ones):

1. `users` — all four roles, discriminated by a `role` column
2. `vendors` — 1:1 with a `users` row where role = vendor
3. `categories` — menu groupings (Rice Dishes, Swallow & Soups, etc.)
4. `menu_items` — belongs to a vendor, optionally a category
5. `orders` — the centre of the schema; links a customer, a vendor
6. `order_items` — order line items, own surrogate key (2NF, Section 3.8.4)
7. `payments` — 1:1 with an order, tracks gateway + reference for webhook verification
8. `deliveries` — 0..1 with an order, created once a vendor marks it ready
9. `reviews` — 0..1 with an order, FR8

Every table, column, and relationship here matches the ER diagram in
`docs/fig3_3_er.png` and the normalization discussion in Chapter 3,
Section 3.8.4 — if the two ever disagree, that's a bug to fix, not a
judgment call to make silently.

## Payment integration (Paystack)

- `POST /api/v1/payments/initialize` — starts a payment attempt for a
  `pending` or `payment_failed` order, returns a Paystack checkout URL.
- `POST /api/v1/payments/webhook/paystack` — Paystack's server calls this
  directly. Signature is verified against the **raw** request body
  (`req.rawBody`, captured in `app.js` via `express.json({ verify })`)
  using `PAYSTACK_SECRET_KEY`. The webhook payload itself is never trusted
  for the actual payment status — it only tells us *which* reference to
  re-verify directly against Paystack's `/transaction/verify` endpoint.
- `GET /api/v1/payments/verify/:reference` — used by the frontend
  callback page (`public/shared/payment-callback.html`) for immediate UI
  feedback after the browser redirects back. Also re-verifies directly
  with Paystack rather than trusting the redirect.
- Both the webhook and the verify endpoint funnel through the same
  `applyVerifiedStatus()` function in `paymentService.js`, which is
  idempotent — safe to call twice with the same result, which matters
  because Paystack retries webhooks and the verify endpoint can race with
  webhook delivery.

**Schema note:** `payments.order_id` was originally unique (one payment
per order). Migration 010 relaxed this to support the retry path shown in
the Chapter 3 activity diagram — multiple payment attempts are now
allowed per order, and "at most one *successful* payment per order" is
enforced in `paymentService`, not at the database level.

**To test locally**, Paystack's webhook needs a publicly reachable URL —
use a tool like `ngrok` to tunnel `localhost:3000` and register that URL
plus `/api/v1/payments/webhook/paystack` in your Paystack dashboard's
test-mode webhook settings. Without this, payments will initialize and
the browser redirect will work, but the order will never move to
`confirmed` since nothing will call the webhook.

**Known limitation:** the webhook endpoint currently sits behind the same
global rate limiter as the rest of the API (`RATE_LIMIT_MAX_REQUESTS` in
`.env`). This hasn't caused problems in testing, but a production
deployment handling many transactions would likely want to exempt the
webhook route from that limit.

## Order lifecycle & delivery (FR5, FR6, FR7)

Full chain from a confirmed payment through to delivery:

`confirmed` → vendor `PATCH /orders/:id/prepare` → `preparing` → vendor
`PATCH /orders/:id/ready` → `ready` **(a `deliveries` row is created here,
status `awaiting_rider`)** → rider `PATCH /deliveries/:id/accept` →
`assigned` (order stays `ready`) → rider `PATCH /deliveries/:id/pickup` →
`picked_up`, **order → `out_for_delivery`** → rider `PATCH
/deliveries/:id/deliver` → `delivered`, **order → `delivered`**.

**Scope decisions made along the way:**
- **FR5 (vendor prepare/ready) was built together with FR6/FR7** — it
  was originally deferred to "the payment/fulfillment module," and this
  is that module. Delivery can't function without it.
- **Rider assignment is pull-based (self-claim from a shared pool)**,
  not automatic dispatch. `GET /deliveries/available` lists every
  `awaiting_rider` delivery campus-wide; any rider can accept one.
  `deliveryRepository.claim()` uses a single conditional `UPDATE ... WHERE
  status = 'awaiting_rider' AND rider_id IS NULL` so two riders tapping
  "Accept" within milliseconds of each other can't both win — the second
  request just affects zero rows and gets a clear 409. An automatic
  dispatch algorithm (nearest rider, least-busy) is documented here as
  future work, not built.
- **Rider mark-delivered is the terminal state.** Chapter 3's activity
  diagram describes a customer-confirmation step with a
  `flagged_for_review` escalation for unconfirmed deliveries; that would
  need a scheduled job checking for overdue confirmations, which was
  deliberately cut for MVP scope. `flagged_for_review` still exists in
  the `orders.status` enum for future use, but nothing sets it today.

## Admin & analytics (FR9)

- **Vendor accounts are now admin-only to create** (`POST
  /admin/vendors`), matching Chapter 3's System Assumptions (Section 3.9).
  This closed a real gap: `/auth/register` originally still accepted
  `role: 'vendor'` for public self-registration, contradicting what the
  chapter documents. That's fixed — self-registration is now limited to
  `student`, `staff`, and `rider`.
- **Bootstrapping the first admin** is a genuine chicken-and-egg problem
  once vendor creation requires an admin: run `npm run seed:admin` once
  after migrating. It's idempotent (does nothing if an admin already
  exists) and reads credentials from `.env` (see `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` etc. in `.env.example`).
- **User suspension** (`PATCH /admin/users/:id/active`) is checked at
  login, after password verification — a suspended account and a wrong
  password both fail with the same generic error, so suspension status
  isn't discoverable without already knowing the correct password.
- **Analytics** (`GET /admin/analytics/summary`) computes revenue from
  successful `payments` rows, never from `orders.total_amount` directly
  — an unpaid order isn't revenue. Returns total orders/revenue, an
  orders-by-status breakdown, top-10 revenue by vendor, and daily order
  counts for the last 14 days. This is the module that directly answers
  the "administrators have no operational data at all" gap identified in
  Chapter 3's fact-finding (Section 3.3.4).

## Reviews (FR8)

- **Immutable by design**: `POST /reviews/order/:orderId` creates a
  review once; there is no update/delete endpoint. FR8 covers "rate and
  review," not "edit" — kept simple deliberately, matching the scope
  discipline applied throughout the build. `reviews.order_id` is `UNIQUE`
  at the database level (migration 009), so even a bug in the service's
  duplicate check couldn't create two reviews for one order.
- **Only reviewable once `orders.status = 'delivered'`** — the terminal
  state in this build (see the delivery module notes on why the
  customer-confirmation/escalation path wasn't built).
- **Vendor rating aggregate** (`GET /reviews/vendor-summaries?vendorIds=1,2,3`)
  is a single batched query, not one call per vendor — the student browse
  page fetches it once after loading menu items and fills in a ★ rating
  badge per vendor card. This goes slightly beyond FR8's literal text but
  ties directly back to the "ratings and feedback mechanisms" point in
  Chapter 2's literature review (Section 1.4).
- Review data is joined into the existing order queries (`orderRepository`)
  the same way delivery status already was — no separate "fetch my
  review" round trip needed.

## Setup

```bash
npm install
cp .env.example .env   # fill in DB credentials, JWT secret, payment keys
# create the database itself first, e.g.:
#   mysql -u root -p -e "CREATE DATABASE gsu_food_system;"
npm run migrate          # creates/updates all tables (11 migrations)
npm run seed             # loads baseline categories
npm run seed:admin       # creates the first admin account (see .env for credentials)
npm run dev
```
