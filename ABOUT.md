# About This Project

**Online Campus Food Ordering & Delivery System with Payment Integration**
Final Year Project — Gombe State University

This is the implementation scaffold for the system designed in Chapters One
through Three of the accompanying report. It is a working Node.js/Express
backend and a plain HTML/CSS/JavaScript frontend (no framework, no build
step), structured in a layered, Clean Architecture-inspired style.

## What's in this package

- `src/` — the backend: routes, controllers, services, repositories,
  middleware (auth + error handling), and the Express app/server entry point.
- `public/` — the frontend: one folder per user role (student, vendor,
  rider, admin) plus a `shared/` folder for login and common JS/CSS.
- `database/` — empty for now; SQL migrations and seed data go here next.
- `tests/` — empty for now; unit and integration tests go here next.
- `package.json` — dependencies matching the stack described in Chapter
  Three, Section 3.7.
- `.env.example` — every environment variable the app needs (DB
  credentials, JWT secret, Paystack/Flutterwave keys).
- `README.md` — folder-by-folder explanation and how it maps back to the
  Chapter Three architecture, plus a build checklist.

## What's actually implemented right now

- A complete, working vertical slice for **authentication**: registration,
  login, password hashing (bcrypt), JWT issuance, and role-based access
  control middleware — end to end, from the HTML login form down to the
  database repository. This slice is meant to be the template every other
  module (menu, orders, payment, delivery, admin) copies.
- The full **database schema** (9 tables, numbered migrations, a runner
  script, and seed data for menu categories), built directly from the
  finalised ER diagram in the project's Chapter 3. See `database/` and
  `docs/fig3_3_er.png`.

## What's not implemented yet

Menu management, cart and checkout, payment gateway integration, delivery
tracking, the admin dashboard, and reviews. See the checklist in
`README.md` for the build order.

## Chapter 3 diagrams

The six diagrams referenced throughout Chapter 3 (system architecture, use
case, ER, class, sequence, and activity) are included as PNGs in `docs/`.
They're the source of truth this codebase is built against — table names,
field names, the order lifecycle, and the payment webhook flow all trace
back to them directly.

## How to run it

```bash
npm install
cp .env.example .env    # then fill in your DB credentials and JWT secret
npm run dev
```

You'll need a running MySQL instance and a `users` table before login/
registration will work end to end — that's the next thing we build.
