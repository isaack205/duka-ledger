# Duka Ledger

Duka Ledger is a modern, offline-first web application designed for small businesses to manage their daily sales, track customer and supplier credit, and generate comprehensive business reports. It provides a point-of-sale interface, financial dashboard, and role-based access control.

## 🚀 Features

- **Point of Sale (POS) & Checkout:** Fast checkout interface with auto-checkout options.
- **Offline-First Architecture:** Built with PowerSync and Supabase, ensuring seamless operation even with unstable internet connections. Data is synced in the background.
- **Financial Dashboard:** Real-time business metrics including Monthly Revenue, Net Retained Cash, and Gross Business Volume. Features operational ratio charts that fall back to real-time data when checkouts aren't finalized.
- **Role-Based Access Control (RBAC):**
  - **Admin:** Full access to all features, sensitive financial metrics, past checkout histories, and all reports.
  - **Operator:** Restricted "Operational Workspace" dashboard. Denied access to sensitive reports, manage catalog, and historical register reconciliations.
- **PDF Reporting:** Generate beautifully formatted Daily, Weekly, and Monthly PDF reports with appropriate naming conventions for easy archiving.
- **Customer & Supplier Ledgers:** Keep track of credit issued to customers and debts owed to suppliers.
- **Catalog Management:** Add, edit, and search through product catalogs easily.

## 🛠️ Technology Stack

- **Frontend:** React, Vite, Tailwind CSS (or Vanilla CSS)
- **Backend/Database:** Supabase (PostgreSQL)
- **Offline Sync:** PowerSync
- **PDF Generation:** React-to-Print

## 📦 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- pnpm (recommended) or npm/yarn
- A Supabase Project
- A PowerSync instance linked to your Supabase project

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <repository-url>
   cd duka-ledger
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure Environment Variables:
   Copy the `.env.example` file to `.env` and fill in your Supabase and PowerSync credentials:
   ```bash
   cp .env.example .env
   ```

4. Start the Development Server:
   ```bash
   pnpm run dev
   ```
   The application will be available at `http://localhost:5173`.

## 🔐 Security & Roles
The application relies on a `profiles` table in the database to assign user roles (`admin` or `operator`). By default, new accounts might be treated as operators. To grant admin access, manually update the user's role to `'admin'` in your Supabase dashboard.

## 📝 Scripts
- `pnpm run dev`: Starts the local development server.
- `pnpm run build`: Builds the app for production.
- `pnpm run preview`: Locally preview the production build.
- `pnpm run lint`: Runs ESLint to check for code issues.

## 📄 License
This project is licensed under the MIT License.
