# OfficeEx — Company Finance Manager

OfficeEx is a finance dashboard for tracking project income, owner expenses, and office costs. It uses a **60% company share** rule, supports **multi-currency** (USD, PKR, EUR, GBP), and gives each team member access based on their **role**.

---

## Table of Contents

1. [Who Uses OfficeEx](#who-uses-officeex)
2. [Signing In](#signing-in)
3. [Navigation](#navigation)
4. [Filters & Currency](#filters--currency)
5. [Usage by Role](#usage-by-role)
6. [Page Guide](#page-guide)
7. [Business Rules & Formulas](#business-rules--formulas)
8. [Administrator Guide](#administrator-guide)
9. [Settings](#settings)
10. [Developer Setup](#developer-setup)
11. [Deploy & Android APK](#deploy--android-apk)

---

## Who Uses OfficeEx

| Role | Who it's for | Main job in the app |
|------|----------------|---------------------|
| **Administrator** | Company owner / finance lead | Full access — users, income, all expenses, dashboard, exchange rate |
| **Project Owner** | Person running a project | Log project income and personal expenses that offset company share |
| **Expense Viewer** | Office manager / accountant | Add and update office & fixed expenses only (no income access) |

> The **first person to register** becomes the Administrator automatically.

---

## Signing In

You can sign in two ways:

1. **Continue with Google** — uses your Google account photo and email
2. **Email & password** — sign in or create an account on the Register page

After sign-in, OfficeEx loads your **role** from the team database and shows only the pages you are allowed to use.

---

## Navigation

| Page | Path | Who can see it |
|------|------|----------------|
| **Overview** | `/` | Admin, Project Owner |
| **Income** | `/income` | Admin, Project Owner |
| **Expenses** (My Expenses) | `/expenses` | Admin, Project Owner |
| **Office** | `/office-expenses` | Admin, Expense Viewer |
| **Ledger** | `/transactions` | All signed-in users |
| **Team** | `/users` | Admin only |
| **Settings** | `/settings` | All signed-in users |

On **mobile**, the bottom tab bar shows the most-used pages. Tap **All** to open the full menu.

Use the **sun/moon icon** in the header to switch light and dark mode.

---

## Filters & Currency

Most pages include a **filter toolbar** at the top:

| Control | What it does |
|---------|----------------|
| **Month** | Show data for one month or **All months** in the selected year |
| **Year** | Financial year to view |
| **Owner** | Filter by project owner (admin only on income/expense pages) |
| **Currency** | Display currency for totals, charts, and tables |
| **Reset** | Return to current month + year |

### Multi-currency notes

- Each income or expense record stores its **original currency** (USD, PKR, EUR, GBP).
- Totals on the dashboard and reports convert into your chosen **display currency**.
- **Administrators** set **1 USD = ___ PKR** in Settings → Currency. PKR conversions use this rate.

---

## Usage by Role

### Administrator

- View the full **Overview** dashboard (charts, payables, section balances).
- Manage **all** project income and owner expenses.
- Manage **office expenses** (fixed monthly + additional line items).
- Add, edit, and remove **team members** and assign roles.
- Set the **USD → PKR** exchange rate.
- Export **PDF** reports from expense and ledger pages.

### Project Owner

- Log **project income** each month (company share is calculated automatically).
- Track **personal expenses** that reduce what you owe the company.
- View your **net payable** on Overview and Income pages.
- See **Ledger** entries for your own activity.
- Cannot access Office Expenses or Team management.

### Expense Viewer

- Land on **Office Expenses** after sign-in (no income dashboard).
- Update **fixed monthly expenses** (electricity, salaries, rent, maintenance, misc).
- **Add and edit** additional office expense line items.
- View **Ledger** (expense transactions only).
- Cannot see income, owner expenses, or team list.

---

## Page Guide

### Overview (Dashboard)

Your financial snapshot for the filtered period:

- **Net balance**, income, expenses, profit/loss summary
- **Cash flow chart** — monthly income vs expenses
- **Spend mix** — expense breakdown by category
- **Owner share chart** — project income vs company cut
- **Recent activity** — latest ledger entries
- **Project owner payables** — who owes the company and how much
- **Section balances** — income vs expenses per area

Use filters to change month/year/owner before reading the numbers.

### Income

- **Project owners** add monthly project income with amount, currency, date, and description.
- **Company share (60%)** is calculated and stored automatically.
- **Administrators** see all owners; **project owners** see only their own records.
- The payables banner shows: **Net Payable = Company Share − Owner Expenses**.

### Expenses (Owner Expenses)

Personal costs that **reduce** what a project owner owes the company:

- Add expenses with name, amount, currency, date, and description.
- Project owners manage **only their own** records.
- Administrators can view and manage **everyone's** owner expenses.

### Office Expenses

Two sections:

1. **Fixed Monthly Expenses** — standard categories (electricity, salaries, rent, maintenance, misc). Enter amounts for the filtered month and click **Save Amounts**.
2. **Additional Office Expenses** — one-off items (salaries, rent, internet, food, etc.) with full details.

Use **Export PDF** to download a report for the selected period.

### Ledger (Transactions)

A combined list of income and expense movements. Filter by month, year, and owner. Export to PDF when needed.

### Team (Admin only)

Manage who can access OfficeEx:

| Action | How |
|--------|-----|
| **Add User** | Create email/password account + assign role |
| **Link Existing** | Connect a Firebase Auth account (by email or UID) to a team profile |
| **Edit User** | Change name, email, or role |
| **Filter** | Filter list by role using the pills at the top |

Each member shows an avatar (Google photo or generated placeholder), role badge, and join date.

### Settings

| Section | Contents |
|---------|----------|
| **Account** | Your name, email, role, and Firebase User ID |
| **Currency** | Display currency; admin can set USD → PKR rate |
| **Appearance** | Light / dark theme |
| **Business Rules** | Summary of how calculations work |

---

## Business Rules & Formulas

### Company share

```
Company Share = Project Income × 60%
Owner Retained = Project Income × 40%
```

### Net payable (what owner owes the company)

```
Net Payable to Company = Company Share (60%) − Owner Expenses
```

Example: If a project owner reports **$10,000** income and **$2,000** in personal expenses:

- Company share = **$6,000**
- Net payable = **$6,000 − $2,000 = $4,000**

### Dashboard totals

- **Total Income** = sum of company share from all filtered income records
- **Total Expenses** = owner expenses + office expenses (fixed + additional)
- **Net Balance** = total income − total expenses

---

## Administrator Guide

### Adding a new team member

**Option A — Create account (recommended)**

1. Go to **Team → Add User**
2. Enter name, email, temporary password, and role
3. Share login details with the user (they should change password later if using email login)

**Option B — Link existing Firebase account**

1. Go to **Team → Link Existing**
2. Choose **Link by email** (looks up Firebase Auth) or **Link by UID** (from Firebase Console)
3. Assign name and role

Users who sign in with **Google** for the first time are added automatically as **Expense Viewer** until an admin changes their role.

### Exchange rate (USD → PKR)

1. **Settings → Currency**
2. Enter how many PKR equal 1 USD
3. Click **Save Rate**

All PKR ↔ USD conversions in reports use this single rate.

### Deploying database rules (required for Team list)

If the Team page is empty or shows a permission error, deploy rules:

```bash
npx -y firebase-tools@latest deploy --only database,auth
```

---

## Settings

See [Page Guide → Settings](#settings-1) above. Your **User ID** is shown under Account — useful when linking accounts manually in Firebase Console.

---

## Developer Setup

### Prerequisites

- Node.js 18+
- Firebase project with **Authentication**, **Realtime Database**, and (optional) **Hosting**

### 1. Firebase project

1. [Firebase Console](https://console.firebase.google.com/) → create or select project
2. Enable **Authentication** → Email/Password and **Google**
3. Create **Realtime Database**
4. Register a **Web App** and copy config values

### 2. Environment

```bash
cp .env.example .env
```

Fill in `.env`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 4. Firebase link & rules

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use --add
npx -y firebase-tools@latest deploy --only database,auth
```

> For Google sign-in locally, add `localhost` under Authentication → Settings → **Authorized domains** (hostname only, no port).

### NPM scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run linter |
| `npm run cap:sync` | Build web app and sync to Capacitor |
| `npm run android:debug` | Build debug APK |

---

## Deploy & Android APK

### Web hosting (Firebase)

```bash
npm run build
npx -y firebase-tools@latest deploy --only hosting
```

### Android APK (Capacitor)

Requires Android Studio and `ANDROID_HOME` configured. Firebase config from `.env` is bundled at build time.

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools

npm run android:debug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

Install on device:

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

> Inside the native app, routes use hash URLs (`/#/income`) so navigation works in the WebView.

---

## Database Schema

```
users/{uid}           → email, displayName, photoURL?, role, createdAt
incomes/{id}          → ownerId, amount, currency, companyShare, month, year, ...
ownerExpenses/{id}    → ownerId, amount, currency, month, year, ...
officeExpenses/{id}   → category, amount, currency, month, year, ...
fixedExpenses/{id}    → month, year, amounts{}, currency
settings/usdToPkr     → number (admin-only write)
```

Security rules: `database.rules.json`

---

## Tech Stack

- React 19 + TypeScript + Vite
- Firebase Authentication (Email + Google)
- Firebase Realtime Database
- Recharts · Capacitor (Android)
- jsPDF (PDF export)

---

## License

MIT
