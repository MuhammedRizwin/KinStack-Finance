# KinStack Finance

KinStack Finance is a private finance tracker built with React, TypeScript, Vinext, Cloudflare Workers, Cloudflare D1, and R2. The app includes income and expense tracking, clients, invoices and quotations, recurring expenses, receipt uploads, reports, and viewer/editor access controls.

## Source package

This archive contains the project source. It excludes Git metadata, dependencies, build output, local runtime state, and environment files. The `.openai/hosting.json` file describes the existing ChatGPT Sites deployment; it contains no login credentials.

## Upload this project to GitHub

For the safest first upload, use GitHub Desktop:

1. Download and extract `KinStack-Finance-Source.zip`.
2. In GitHub Desktop, clone `MuhammedRizwin/KinStack-Finance` to your computer.
3. Copy the extracted project files and folders into that cloned repository. Replace its README with this one if prompted.
4. In GitHub Desktop, review the changed files, enter a summary such as `Add KinStack Finance source`, and choose **Commit to main**.
5. Choose **Push origin**.

Keep `.env*`, `.dev.vars*`, passwords, and secret keys out of GitHub. The source package does not include finance database records or uploaded receipts.

## Current deployment notes

This source is configured for the existing ChatGPT Sites runtime. A Vercel deployment requires changing the Cloudflare-specific database, receipt storage, and ChatGPT sign-in integrations to Supabase equivalents first. The Supabase project exists separately and currently has an empty finance schema. No Vercel project is connected yet.
