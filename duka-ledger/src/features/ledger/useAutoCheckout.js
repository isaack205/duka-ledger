import { useEffect, useRef } from 'react';
import { useQuery } from '@powersync/react';
import { db } from '../../powersync/SetupPowerSync';
import { supabase } from '../../supabase/supabaseClient';

/**
 * Custom hook to automatically close out daily register if no manual checkout is done
 * 1 hour before the day ends (i.e. at or after 23:00 / 11:00 PM local time).
 */
export function useAutoCheckout() {
  const isExecutingRef = useRef(false);

  const { data: customerTransactions } = useQuery(`
    SELECT * FROM customer_ledgers ORDER BY created_at ASC
  `);

  const { data: supplierTransactions } = useQuery(`
    SELECT * FROM supplier_ledgers ORDER BY created_at ASC
  `);

  const { data: pastCheckouts } = useQuery(`
    SELECT * FROM daily_checkouts ORDER BY checkout_date DESC
  `);

  useEffect(() => {
    async function checkAndTriggerAutoCheckout() {
      if (isExecutingRef.current) return;
      if (!pastCheckouts || !customerTransactions || !supplierTransactions) return;

      const now = new Date();
      const currentHour = now.getHours();
      const todayStr = now.toISOString().split('T')[0];

      // "1 hour before the day ends" corresponds to 23:00 (11:00 PM) local time onwards
      const isCutoffReached = currentHour >= 23;
      if (!isCutoffReached) return;

      // Check if today's register is already closed
      const hasCheckoutToday = pastCheckouts.some((co) => co.checkout_date === todayStr);
      if (hasCheckoutToday) return;

      isExecutingRef.current = true;

      try {
        // Calculate today's supplier outflows (cash & mpesa)
        let supplierCashPaid = 0;
        let supplierMpesaPaid = 0;
        let supplierDebtCreated = 0;

        (todaySupplierTransactions || []).forEach((tx) => {
          const upfront = parseFloat(tx.amount_paid_upfront || 0);
          const isRepayment = tx.transaction_type === 'repayment';
          const repaymentVal = isRepayment ? Math.abs(parseFloat(tx.net_debt_amount || 0)) : 0;
          const method = tx.payment_method || 'cash';

          if (tx.transaction_type === 'debt') {
            supplierDebtCreated += parseFloat(tx.net_debt_amount || 0);
          }

          if (isRepayment) {
            if (method === 'mpesa') supplierMpesaPaid += repaymentVal;
            else supplierCashPaid += repaymentVal;
          } else if (upfront > 0) {
            if (method === 'mpesa') supplierMpesaPaid += upfront;
            else supplierCashPaid += upfront;
          }
        });

        // Calculate today's customer credit movements
        let customerCreditIssued = 0;
        let customerDebtRecovered = 0;

        (todayCustomerTransactions || []).forEach((tx) => {
          if (tx.transaction_type === 'debt') {
            customerCreditIssued += parseFloat(tx.net_debt_amount || 0);
          } else if (tx.transaction_type === 'repayment') {
            customerDebtRecovered += Math.abs(parseFloat(tx.net_debt_amount || 0));
          }
        });

        const autoCash = 0;
        const autoMpesa = 0;
        const subtotalA = autoCash + autoMpesa;
        const subtotalB = supplierCashPaid + supplierMpesaPaid;
        const netCashPosition = subtotalA; // A
        const totalCashRealized = subtotalA + subtotalB; // A + B
        const totalBusinessVolume = (subtotalA + subtotalB) + customerCreditIssued; // (A + B) + C

        const { data: { session } } = await supabase.auth.getSession();

        await db.execute(
          `INSERT INTO daily_checkouts (
            id, total_cash_collected, total_mpesa_collected, 
            supplier_cash_paid, supplier_mpesa_paid,
            customer_credit_issued, customer_debt_recovered, supplier_debt_created, 
            net_cash_position, total_cash_realized, total_business_volume,
            checkout_date, notes, recorded_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            autoCash.toFixed(2),
            autoMpesa.toFixed(2),
            supplierCashPaid.toFixed(2),
            supplierMpesaPaid.toFixed(2),
            customerCreditIssued.toFixed(2),
            customerDebtRecovered.toFixed(2),
            supplierDebtCreated.toFixed(2),
            netCashPosition.toFixed(2),
            totalCashRealized.toFixed(2),
            totalBusinessVolume.toFixed(2),
            todayStr,
            `Auto checkout: No manual daily checkout was recorded 1 hour before day ended.`,
            session?.user?.id || null,
            new Date().toISOString()
          ]
        );
        console.log(`[AutoCheckout] Successfully auto-closed register for ${todayStr}`);
      } catch (err) {
        console.error('[AutoCheckout] Failed to execute auto checkout:', err);
      } finally {
        isExecutingRef.current = false;
      }
    }

    checkAndTriggerAutoCheckout();

    // Periodic check every 60 seconds
    const intervalId = setInterval(checkAndTriggerAutoCheckout, 60000);
    return () => clearInterval(intervalId);
  }, [pastCheckouts, customerTransactions, supplierTransactions]);
}
