import { column, Schema, Table } from '@powersync/web';

export const AppSchema = new Schema({
  // 1. Categories Table
  categories: new Table({
    category_name: column.text,
    created_at: column.text
  }),

  // 2. Items Catalog Table
  items: new Table({
    category_id: column.text,
    item_name: column.text,
    retail_price: column.text, // NUMERIC values are stored as TEXT to prevent SQLite decimal rounding errors
    previous_price: column.text,
    price_changed_at: column.text,
    updated_at: column.text
  }),

  // 3. Customer Ledger Table
  customer_ledgers: new Table({
    customer_name: column.text,
    customer_phone: column.text,
    item_id: column.text,
    total_item_value: column.text,
    amount_paid_upfront: column.text,
    net_debt_amount: column.text,
    transaction_type: column.text,
    payment_method: column.text, // 'cash' | 'mpesa' | null (null when no money changes hands)
    notes: column.text,
    recorded_by: column.text,
    created_at: column.text
  }),

  // 4. Supplier Ledger Table
  supplier_ledgers: new Table({
    supplier_name: column.text,
    supplier_phone: column.text,
    total_invoice_value: column.text,
    amount_paid_upfront: column.text,
    net_debt_amount: column.text,
    transaction_type: column.text,
    payment_method: column.text, // 'cash' | 'mpesa' | null
    notes: column.text,
    recorded_by: column.text,
    created_at: column.text
  }),

  // 5. Daily Checkouts Table
  daily_checkouts: new Table({
    // Section 1: Register & Till Count (manual)
    total_cash_collected: column.text,
    total_mpesa_collected: column.text,
    // Section 2: Supplier Outflows (auto-calculated)
    supplier_cash_paid: column.text,
    supplier_mpesa_paid: column.text,
    // Section 3: Credit/Debt Movements (auto-calculated)
    customer_credit_issued: column.text,
    customer_debt_recovered: column.text,
    supplier_debt_created: column.text,
    // Computed metrics
    net_cash_position: column.text,
    total_cash_realized: column.text,
    total_business_volume: column.text,
    checkout_date: column.text,
    notes: column.text,
    recorded_by: column.text,
    created_at: column.text
  }),
});