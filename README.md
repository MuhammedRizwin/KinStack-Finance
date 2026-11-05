# KinStack Finance

KinStack Finance is a responsive finance workspace built with Next.js, Supabase Auth, Supabase Postgres, and private Supabase Storage. It supports email/password sign-in, transactions, clients, invoices, quotations, recurring expenses, reports, receipt uploads, and team roles.

## Team roles

- **Superadmin** manages team access and all finance records.
- **Editor** can view and edit finance records.
- **Viewer** can view and export finance records but cannot change them.

The superadmin account is restricted to `muhammedrizwinsadique@gmail.com`. The first successful sign-in for that address initializes the workspace. Other accounts have no access until the superadmin assigns a role.

## Supabase setup

1. In the Supabase dashboard, open **Authentication → Users → Add user** and create the superadmin account for `muhammedrizwinsadique@gmail.com` with a password.
2. The Supabase schema is in `supabase/setup.sql`. It has already been applied to the KinStack Finance project. It creates KinStack-specific tables with row-level security and a private receipt bucket; it leaves the existing generic starter tables alone.
3. To add a team member, first create their email/password account under **Authentication → Users**. Then sign in as superadmin and assign Editor or Viewer in the app’s **Team** section.

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
