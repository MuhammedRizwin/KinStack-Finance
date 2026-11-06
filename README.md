# KinStack Finance

KinStack Finance is a responsive finance workspace built with Next.js, Supabase Auth, Supabase Postgres, and private Supabase Storage. It supports email/password sign-in, transactions, clients, invoices, quotations, recurring expenses, reports, receipt uploads, and team roles.

## Team roles

- **Superadmin** manages team access and all finance records.
- **Editor** can view and edit finance records.
- **Viewer** can view and export finance records but cannot change them.

The first superadmin account is `muhammedrizwinsadique@gmail.com`; its first successful sign-in initializes the workspace. Superadmins can assign Viewer, Editor, or Superadmin to other members from Team. Each member has one role; Superadmin includes full finance and team access. The database prevents removing or demoting the last superadmin. Other accounts have no workspace access until a superadmin assigns a role.

## Supabase setup

1. In the Supabase dashboard, open **Authentication → Users → Add user** and create the superadmin account for `muhammedrizwinsadique@gmail.com` with a password.
2. The Supabase schema is in `supabase/setup.sql`. It has already been applied to the KinStack Finance project. It creates KinStack-specific tables with row-level security and a private receipt bucket; it leaves the existing generic starter tables alone.
3. To add a team member, sign in as superadmin and open **Team → Add team member**. Enter their name, optional designation, email, password (at least 12 characters), and Viewer, Editor, or Superadmin role. Names and designations appear in the Team list and can be edited later. Select **Use existing login** for an account that already exists. Share credentials privately; saved passwords are never displayed. The `finance-create-member` Supabase Edge Function creates the account after validating the caller’s superadmin membership. It uses Supabase’s built-in server credentials; no service key is sent to Vercel or the browser.

## Vercel environment variables

Set these for Production, Preview, and Development:

```text
NEXT_PUBLIC_SUPABASE_URL=https://iwckfdgirvjvbgvvmiui.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
SUPERADMIN_EMAIL=muhammedrizwinsadique@gmail.com
```

The publishable key is intended for browser use. The project does not put a Supabase service-role or secret key in the app. Never commit `.env.local` or any secret key.

## Run locally

```bash
pnpm install
pnpm dev
```

Create `.env.local` in the project root with the three variables above before signing in. Build with `pnpm build`.

## Data migration note

The earlier ChatGPT Sites version used a separate Cloudflare database and file bucket. Those records and receipts are not copied automatically into Supabase. They remain in the earlier app until they are exported and imported separately.

## Member creation function

Source: `supabase/functions/finance-create-member/index.ts`. Deploy to the same Supabase project. Platform JWT verification is disabled because the handler validates the bearer token using `auth.getUser` before checking the caller’s stored superadmin role. New account creation never updates an existing user’s password.

## Appearance

Use the light/dark mode switch at the top-right of the workspace, mobile top bar, or sign-in screen. Each browser remembers its chosen theme.

## Password recovery

The sign-in page links to `/forgot-password`. Supabase emails a recovery link, `/auth/recovery` exchanges the PKCE code for a session, and `/reset-password` lets the account owner choose a new password. Recovery links must be opened in the same browser that requested them. Missing, expired, or reused links show a request-new-link screen. Password updates sign the account out of existing refresh sessions.

In Supabase Auth URL Configuration, use `https://kinstack-finance.vercel.app` as Site URL and allow `https://kinstack-finance.vercel.app/auth/recovery` as a redirect URL. The default recovery email template works with this flow. **Custom SMTP is required to send reset emails to ordinary app members**; Supabase’s test sender is restricted to organization team addresses. No SMTP credentials are stored in this repository.

## Superadmin password management

Superadmins can open **Team → Edit Member → Change Password**, enter and confirm a new password, then save. This updates only the selected existing member’s password; profile and role edits use their own Save action. `finance-change-member-password` verifies the signed-in caller’s superadmin role and the target’s membership in the same workspace before calling Supabase Auth Admin. It does not reveal old passwords or include plaintext passwords in finance records or responses. This option does not require SMTP. The existing Forgot Password flow remains available and needs a configured email sender for ordinary app members.

## Initial loading

The root route checks the session before rendering the dashboard and loads the initial finance snapshot on the server. Public sign-in/recovery screens skip session-refresh work in the proxy. The dashboard uses the server snapshot without a second mount-time finance request; later mutations refresh through the protected API. A centered animated KinStack logo appears during server loading and sign-in, with reduced-motion support. Private pages and finance responses use no-store caching.

### Member loans

Apply `supabase/member-loans.sql` after `supabase/setup.sql` when setting up a new database. The deployed database already has this schema.

Member Loans tracks principal lent from agency funds, borrower name, currency, loan date, due date, notes, and actual repayments (including partial repayments). Editors and superadmins can create or correct entries; viewers have read-only access. Loan principal, currency and loan date cannot change once repayments exist. Remove an incorrect repayment before replacing it; loans with repayment history cannot be deleted.

Loan movements are separate from business income and expenses. Overview shows available agency funds and outstanding member loans for each currency. Net cash flow and monthly report totals include loans and repayments by their actual dates. The business payments chart and transaction CSV cover business transactions only; loan history is displayed under Member Loans. No money moves automatically. Amounts are stored as integer minor units. Database constraints and triggers validate repayments and serialize concurrent inserts to prevent overpayment.

For an outstanding loan, **Mark as paid** opens a confirmation with the remaining principal filled in. Confirm the actual repayment date, method and optional reference. Saving records a repayment, changes the badge to Paid, updates available funds, and opens its repayment history. **Record partial repayment** remains available for instalments. Viewers cannot mark loans as paid.
