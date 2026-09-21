const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculatePartnerSummary,
  calculateSupplierBalance,
  calculateExpenseBreakdown,
  calculateReportSummary,
} = require('../app/src/main/assets/accounting.js');

test('splits distributable profit equally and deducts each partner withdrawal from their own share', () => {
  const result = calculatePartnerSummary({
    expectedProfit: 1000,
    otherIncome: 0,
    expenses: 0,
    withdrawals: [
      { person: 'محمد إبراهيم', amount: 50 },
      { person: 'أحمد عبدالعظيم', amount: 50 },
    ],
  });

  assert.equal(result.distributableProfit, 1000);
  assert.equal(result.partners['محمد إبراهيم'].share, 500);
  assert.equal(result.partners['محمد إبراهيم'].withdrawn, 50);
  assert.equal(result.partners['محمد إبراهيم'].remaining, 450);
  assert.equal(result.partners['أحمد عبدالعظيم'].share, 500);
  assert.equal(result.partners['أحمد عبدالعظيم'].withdrawn, 50);
  assert.equal(result.partners['أحمد عبدالعظيم'].remaining, 450);
});

test('keeps withdrawals attributed to the correct partner', () => {
  const result = calculatePartnerSummary({
    expectedProfit: 1000,
    otherIncome: 200,
    expenses: 100,
    withdrawals: [
      { person: 'محمد إبراهيم', amount: 125 },
      { person: 'أحمد عبدالعظيم', amount: 25 },
    ],
  });

  assert.equal(result.distributableProfit, 1100);
  assert.equal(result.partners['محمد إبراهيم'].remaining, 425);
  assert.equal(result.partners['أحمد عبدالعظيم'].remaining, 525);
});

test('subtracts supplier returns from the supplier account balance', () => {
  assert.equal(calculateSupplierBalance({ invoices: 10000, payments: 2000, returns: 1000 }), 7000);
});

test('preserves a supplier credit when returns exceed the amount due', () => {
  assert.equal(calculateSupplierBalance({ invoices: 500, payments: 0, returns: 1000 }), -500);
});

test('groups expense totals by type inside the selected date range', () => {
  const result = calculateExpenseBreakdown([
    { date: '2026-08-31', type: 'فطار', amount: 30 },
    { date: '2026-09-01', type: 'فطار', amount: 30 },
    { date: '2026-09-02', type: 'فطار', amount: 30 },
    { date: '2026-09-03', type: 'إيجار المدرسة', amount: 100 },
    { date: '2026-10-01', type: 'فطار', amount: 30 },
  ], '2026-09-01', '2026-09-30');

  assert.deepEqual(result, [
    { type: 'إيجار المدرسة', count: 1, total: 100 },
    { type: 'فطار', count: 2, total: 60 },
  ]);
});

test('summarizes actual sales and inventory value, cost, and profit', () => {
  const result = calculateReportSummary({
    actualSales: 20000,
    purchaseLines: [
      { product_id: 1, pieces: 100, purchase_total: 800, expected_sales: 1000, expected_profit: 200 },
    ],
    inventoryLines: [
      { product_id: 1, qty: 10, sale_price: 10, value: 100 },
    ],
  });

  assert.equal(result.salesMarginPercent, 20);
  assert.equal(result.salesCost, 16000);
  assert.equal(result.salesProfit, 4000);
  assert.equal(result.inventorySaleValue, 100);
  assert.equal(result.inventoryCost, 80);
  assert.equal(result.inventoryProfit, 20);
  assert.equal(result.totalSaleValue, 20100);
  assert.equal(result.totalCost, 16080);
  assert.equal(result.totalProfit, 4020);
});

test('uses purchase history through the report end to value older inventory', () => {
  const result = calculateReportSummary({
    actualSales: 0,
    purchaseLines: [],
    costLines: [
      { product_id: 1, pieces: 100, purchase_total: 800, expected_sales: 1000, expected_profit: 200 },
    ],
    inventoryLines: [
      { product_id: 1, qty: 10, sale_price: 10, value: 100 },
    ],
  });

  assert.equal(result.inventoryCost, 80);
});

test('uses purchase history through the report end to estimate sales profit', () => {
  const result = calculateReportSummary({
    actualSales: 20000,
    purchaseLines: [],
    marginLines: [
      { expected_sales: 1000, expected_profit: 200 },
    ],
  });

  assert.equal(result.salesMarginPercent, 20);
  assert.equal(result.salesProfit, 4000);
});

test('keeps sales value separate and adds other income only to final profit', () => {
  const result = calculateReportSummary({
    actualSales: 20000,
    otherIncome: 330,
    purchaseLines: [
      { expected_sales: 1000, expected_profit: 200 },
    ],
  });

  assert.equal(result.otherIncome, 330);
  assert.equal(result.totalRevenue, 20330);
  assert.equal(result.totalSaleValue, 20000);
  assert.equal(result.salesProfitWithIncome, 4330);
  assert.equal(result.totalProfit, 4330);
});
