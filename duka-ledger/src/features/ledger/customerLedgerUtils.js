export function normalizeQueryRows(transactions) {
  if (Array.isArray(transactions)) {
    return transactions;
  }

  if (Array.isArray(transactions?.data)) {
    return transactions.data;
  }

  if (Array.isArray(transactions?.rows)) {
    return transactions.rows;
  }

  if (Array.isArray(transactions?.result)) {
    return transactions.result;
  }

  return [];
}

export function getCustomerSummaryData(transactions = [], name) {
  const transactionRows = normalizeQueryRows(transactions);
  const customerTx = transactionRows.filter(t => t.customer_name === name);

  const debts = customerTx
    .filter(t => t.transaction_type === 'debt')
    .map(d => ({ ...d, remaining: parseFloat(d.net_debt_amount) }));
  const repayments = customerTx.filter(t => t.transaction_type === 'repayment');

  const totalDebt = debts.reduce((sum, d) => sum + parseFloat(d.net_debt_amount), 0);
  const totalRepayed = repayments.reduce((sum, r) => sum + Math.abs(parseFloat(r.net_debt_amount)), 0);
  const remainingDebt = Math.max(0, totalDebt - totalRepayed);

  let repaymentPool = totalRepayed;
  const processedDebts = debts.map(debt => {
    let remaining = debt.remaining;
    if (repaymentPool > 0) {
      if (repaymentPool >= remaining) {
        repaymentPool -= remaining;
        remaining = 0;
      } else {
        remaining -= repaymentPool;
        repaymentPool = 0;
      }
    }

    return { ...debt, remainingBalance: remaining, isCleared: remaining === 0 };
  });

  const historyTimeline = [
    ...processedDebts.map(d => ({ ...d, displayType: 'debt' })),
    ...repayments.map(r => ({ ...r, displayType: 'repayment' }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return {
    totalDebt,
    totalRepayed,
    remainingDebt,
    timeline: historyTimeline,
    phone: customerTx[0]?.customer_phone || '',
  };
}