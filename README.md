# OfficeEx — Company Finance Manager

A modern React dashboard for managing company finances with Firebase Realtime Database. Track project owner income, office expenses, and view real-time financial analytics.

## Features

- **Authentication** — Email/password and Google sign-in with role-based access (Admin, Project Owner & Expense Viewer)
- **Project Income** — Project owners log monthly income; company share (60%) is calculated automatically
- **Expense Management** — Project owners manage personal expenses; admins manage office expenses
- **Dashboard** — Total income, expenses, net balance, profit/loss with interactive charts
- **Filters** — Filter by month, year, and project owner
- **Dark/Light Mode** — Toggle theme preference
- **Responsive UI** — Sidebar navigation, works on mobile and desktop

## Tech Stack

- React 19 + TypeScript + Vite
- Firebase Authentication
- Firebase Realtime Database
- Recharts for data visualization
- React Router for navigation

## Getting Started

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use an existing one)
3. Enable **Authentication** → **Email/Password** and **Google** providers
4. Create **Realtime Database** (Build → Realtime Database → Create Database)
5. Register a **Web App** and copy the config values

> **Important:** Realtime Database must be created in the console before the app can load data. Without it, the dashboard will show an error after login.

### 2. Configure Environment

Copy the example env file and fill in your Firebase config:

```bash
cp .env.example .env
```

Edit `.env` with your Firebase web app credentials:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. Link Firebase Project & Deploy Rules

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use --add
npx -y firebase-tools@latest deploy --only database,auth
```

> **Google sign-in:** `firebase.json` includes Google provider config for OfficeEx. Deploying `auth` enables Google OAuth for your project. For local dev, ensure `localhost` is in Firebase Console → Authentication → Settings → **Authorized domains** (no `http://` or port).

### 4. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 5. Build & Deploy

```bash
npm run build
npx -y firebase-tools@latest deploy --only hosting
```

### 6. Build Android APK

OfficeEx is a web app wrapped with [Capacitor](https://capacitorjs.com/) for Android. Your Firebase config from `.env` is baked into the APK at build time — make sure `.env` is filled in before building.

#### Prerequisites

1. **Android Studio** — [Download](https://developer.android.com/studio) and install (includes Android SDK + JDK)
2. After install, set `ANDROID_HOME` (macOS default):

   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

#### Debug APK (for testing)

```bash
npm run android:debug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

Install on a connected device:

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

#### Release APK (for distribution)

Open the project in Android Studio to create a signing key, then:

```bash
npm run android:release
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

#### Other useful commands

| Command | Description |
|---------|-------------|
| `npm run cap:sync` | Rebuild web app and copy into Android project |
| `npm run cap:android` | Sync and open Android Studio |

> **Note:** Routing uses hash URLs (`/#/income`) inside the native app so navigation works in the WebView.

## User Roles

| Role | Permissions |
|------|-------------|
| **Administrator** | Manage office expenses, view all data, full dashboard access |
| **Project Owner** | Add/edit/delete own income and expense records |

> The **first registered user** automatically becomes the Administrator.

## Business Rules

- Project owners enter monthly project income
- Company income = **60%** of each project owner's reported income
- Project owners can only CRUD their own income/expense records
- Administrators manage office expenses: Salaries, Rent, Electricity, Internet, Food, Miscellaneous

## Office Expense Categories

- Employee Salaries
- Office Rent
- Electricity Bills
- Internet Bills
- Food & Refreshments
- Miscellaneous Expenses

## Project Structure

```
src/
├── components/
│   ├── auth/          # Protected routes
│   ├── charts/        # Recharts visualizations
│   ├── layout/        # Sidebar, header, app shell
│   └── ui/            # Reusable UI components
├── context/           # Auth, theme, filter state
├── hooks/             # Firebase data hooks
├── lib/               # Firebase config, calculations, utils
├── pages/             # Route pages
└── types/             # TypeScript interfaces
```

## Database Schema

```
users/{uid}           → email, displayName, role, createdAt
incomes/{id}          → ownerId, amount, companyShare, month, year, description
ownerExpenses/{id}    → ownerId, amount, month, year, description
officeExpenses/{id}   → category, amount, month, year, description
```

Security rules are defined in `database.rules.json`.

## License

MIT
