# Duka-Ledger 🏪

Duka-Ledger is an offline-first point-of-sale and store management web application built specifically for retail shops (a "duka" is a shop in Swahili). It helps shop owners seamlessly track their daily retail operations, manage ledgers with both customers and suppliers, handle daily checkouts, and maintain a product catalog.

## ✨ Key Features

- **📊 Dashboard:** Get a bird's-eye view of your shop's operations and daily performance.
- **👥 Customer Ledger:** Easily track customer transactions, credits, and outstanding debts.
- **📦 Supplier Ledger:** Keep a record of stock deliveries, payments, and balances with your suppliers.
- **🛒 Daily Checkout:** A fast and intuitive point-of-sale interface to record daily sales and transactions.
- **📖 Product Catalog:** Manage your shop's inventory and prices, and quickly search for products during checkout.
- **📶 Offline-First:** Powered by PowerSync, the app works flawlessly even with spotty internet connections, automatically syncing data to the cloud once connectivity is restored.

## 🛠️ Technology Stack

- **Frontend:** React 19, Vite
- **Styling:** Tailwind CSS v4
- **Routing:** React Router v7
- **Backend & Auth:** Supabase
- **Offline Sync:** PowerSync
- **PWA:** vite-plugin-pwa for progressive web app capabilities

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- A Supabase account and project
- A PowerSync account and project

### Installation

1. Navigate into the app directory:
   ```bash
   cd duka-ledger
   ```

2. Install dependencies (e.g., with npm, pnpm, or yarn):
   ```bash
   npm install
   ```

3. Set up your environment variables:
   Copy `.env.example` to `.env` and fill in your Supabase and PowerSync credentials.

4. Start the development server:
   ```bash
   npm run dev
   ```

### Building for Production
To build the app for production:
```bash
npm run build
```
