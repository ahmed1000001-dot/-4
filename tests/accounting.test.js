const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculatePartnerSummary,
  calculateSupplierBalance,
  calculateExpenseBreakdown,
  calculateReportSummary,
  calculateNetPurchaseLines,
  calculateNetExpectedProfit,
  calculateAvailableReturnQty,
  allocateSupplierReturnsByInvoice,
  calculateInventoryValuation,
  validatePurchaseInvoiceEdit,
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

test('subtracts itemized supplier return margin before calculating partner profit', () => {
  const result = calculatePartnerSummary({
    expectedProfit: 500,
    supplierReturnLines: [{ purchase_line_id: 11, qty: 2, unit_expected_profit: 25, amount: 900 }],
    otherIncome: 30,
    expenses: 20,
  });

  assert.equal(result.distributableProfit, 460);
  assert.equal(result.partners['محمد إبراهيم'].share, 230);
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

test('removes returned item cost, expected sale, and margin from its purchase batch', () => {
  const purchases = [
    { id: 11, product_id: 1, pieces: 10, purchase_total: 100, expected_sales: 110, expected_profit: 10 },
    { id: 12, product_id: 2, pieces: 10, purchase_total: 100, expected_sales: 200, expected_profit: 100 },
  ];
  const returns = [{
    purchase_line_id: 12,
    qty: 2,
    unit_cost: 10,
    unit_sale_price: 20,
    unit_expected_profit: 10,
    date: '2026-09-12',
  }];

  const netLines = calculateNetPurchaseLines(purchases, returns, '2026-09-30');

  assert.equal(netLines[0].pieces, 10);
  assert.equal(netLines[1].pieces, 8);
  assert.equal(netLines[1].purchase_total, 80);
  assert.equal(netLines[1].expected_sales, 160);
  assert.equal(netLines[1].expected_profit, 80);
  assert.equal(calculateNetExpectedProfit(110, returns, '', '2026-09-30'), 90);
});

test('adds back the edited return quantity but reserves quantities in other draft lines', () => {
  assert.equal(calculateAvailableReturnQty({
    purchasedQty: 10,
    alreadyReturnedQty: 6,
    editingReturnQty: 2,
    otherDraftQty: 1,
  }), 5);
  assert.equal(calculateAvailableReturnQty({ purchasedQty: 10, alreadyReturnedQty: 10 }), 0);
});

test('applies itemized supplier credit to its purchase invoice and leaves old returns for legacy allocation', () => {
  const result = allocateSupplierReturnsByInvoice({
    supplierReturns: [
      { id: 1, supplier_id: 4, amount: 30 },
      { id: 2, supplier_id: 8, amount: 12 },
    ],
    supplierReturnLines: [
      { return_id: 1, purchase_line_id: 10, qty: 1, unit_cost: 10 },
      { return_id: 1, purchase_line_id: 20, qty: 2, unit_cost: 10 },
    ],
    purchaseLines: [
      { id: 10, invoice_id: 100 },
      { id: 20, invoice_id: 200 },
    ],
  });

  assert.deepEqual(result, {
    invoiceAmounts: { 100: 10, 200: 20 },
    legacyBySupplier: { 8: 12 },
  });
});

test('does not apply supplier returns outside the selected report dates or before their return date', () => {
  const purchase = [{ id: 7, product_id: 3, pieces: 5, purchase_total: 50, expected_sales: 100, expected_profit: 50 }];
  const returns = [{
    purchase_line_id: 7, qty: 1, unit_cost: 10, unit_sale_price: 20, unit_expected_profit: 10,
    date: '2026-09-20', amount: 10,
  }];

  assert.equal(calculateNetPurchaseLines(purchase, returns, '2026-09-19')[0].expected_profit, 50);
  assert.equal(calculateNetExpectedProfit(50, returns, '2026-09-01', '2026-09-19'), 50);
  assert.equal(calculateNetExpectedProfit(50, returns, '2026-09-01', '2026-09-30'), 40);
  assert.equal(calculateNetExpectedProfit(50, [{ date: '2026-09-10', amount: 10 }], '', '2026-09-30'), 50);
});

test('estimates sales profit using net purchase margins and keeps supplier credit out of sales', () => {
  const result = calculateReportSummary({
    actualSales: 270,
    marginLines: [
      { id: 1, product_id: 1, pieces: 10, purchase_total: 100, expected_sales: 110, expected_profit: 10 },
      { id: 2, product_id: 2, pieces: 10, purchase_total: 100, expected_sales: 200, expected_profit: 100 },
    ],
    supplierReturnLines: [{
      purchase_line_id: 2, qty: 2, unit_cost: 10, unit_sale_price: 20, unit_expected_profit: 10,
      date: '2026-09-12', amount: 20,
    }],
    returnsThroughDate: '2026-09-30',
  });

  assert.equal(result.expectedSales, 270);
  assert.equal(result.expectedProfit, 90);
  assert.equal(result.salesProfit, 90);
  assert.equal(result.totalRevenue, 270);
});

test('values counted stock at net weighted purchase cost, sale price, and remaining potential margin', () => {
  const purchases = [
    { id: 21, product_id: 9, pieces: 10, purchase_total: 100, expected_sales: 200, expected_profit: 100 },
    { id: 22, product_id: 9, pieces: 10, purchase_total: 50, expected_sales: 150, expected_profit: 100 },
  ];
  const netPurchases = calculateNetPurchaseLines(purchases, [{
    purchase_line_id: 22, qty: 2, unit_cost: 5, unit_sale_price: 15, unit_expected_profit: 10,
    date: '2026-09-12',
  }], '2026-09-30');
  const valuation = calculateInventoryValuation([
    { product_id: 9, product: 'بسكوت', qty: 4, sale_price: 15, value: 60 },
  ], netPurchases);

  assert.deepEqual(valuation.lines[0], {
    product_id: 9,
    product: 'بسكوت',
    qty: 4,
    costKnown: true,
    unitCost: 140 / 18,
    costValue: 31.11,
    unitSalePrice: 15,
    saleValue: 60,
    potentialProfit: 28.89,
  });
  assert.equal(valuation.totalCost, 31.11);
  assert.equal(valuation.totalSaleValue, 60);
  assert.equal(valuation.totalPotentialProfit, 28.89);
});

test('does not claim zero cost or full sale value as profit when purchase cost is unknown', () => {
  const valuation = calculateInventoryValuation([
    { product_id: 99, product: 'صنف بلا فاتورة شراء', qty: 5, sale_price: 8, value: 40 },
  ], []);

  assert.equal(valuation.lines[0].costKnown, false);
  assert.equal(valuation.lines[0].unitCost, null);
  assert.equal(valuation.lines[0].costValue, null);
  assert.equal(valuation.lines[0].potentialProfit, null);
  assert.equal(valuation.totalSaleValue, 40);
  assert.equal(valuation.unpricedLineCount, 1);
  assert.equal(valuation.unpricedQty, 5);
});

const editInvoiceLines = [
  { id: 41, product_id: 7, pieces: 24 },
  { id: 42, product_id: 8, pieces: 12 },
];
const editInvoiceReturns = [{ purchase_line_id: 41, qty: 4 }];

test('allows changing the supplier when the invoice has no itemized returns', () => {
  assert.equal(typeof validatePurchaseInvoiceEdit, 'function');
  if (typeof validatePurchaseInvoiceEdit !== 'function') return;
  assert.equal(validatePurchaseInvoiceEdit({
    originalLines: editInvoiceLines,
    editedLines: [{ id: 41, product_id: 7, pieces: 24 }, { id: 43, product_id: 9, pieces: 5 }],
    returnLines: [],
    supplierChanged: true,
  }), null);
});

test('rejects changing supplier when the invoice has an itemized return', () => {
  assert.equal(typeof validatePurchaseInvoiceEdit, 'function');
  if (typeof validatePurchaseInvoiceEdit !== 'function') return;
  assert.equal(validatePurchaseInvoiceEdit({
    originalLines: editInvoiceLines,
    editedLines: editInvoiceLines,
    returnLines: editInvoiceReturns,
    supplierChanged: true,
  }), 'supplier_has_returns');
});

test('rejects removing a purchase line that has returned items', () => {
  assert.equal(typeof validatePurchaseInvoiceEdit, 'function');
  if (typeof validatePurchaseInvoiceEdit !== 'function') return;
  assert.equal(validatePurchaseInvoiceEdit({
    originalLines: editInvoiceLines,
    editedLines: [{ id: 42, product_id: 8, pieces: 12 }],
    returnLines: editInvoiceReturns,
  }), 'returned_line_removed');
});

test('rejects changing the product on a purchase line that has returned items', () => {
  assert.equal(typeof validatePurchaseInvoiceEdit, 'function');
  if (typeof validatePurchaseInvoiceEdit !== 'function') return;
  assert.equal(validatePurchaseInvoiceEdit({
    originalLines: editInvoiceLines,
    editedLines: [{ id: 41, product_id: 99, pieces: 24 }, editInvoiceLines[1]],
    returnLines: editInvoiceReturns,
  }), 'returned_product_changed');
});

test('rejects reducing a purchase line below its returned quantity', () => {
  assert.equal(typeof validatePurchaseInvoiceEdit, 'function');
  if (typeof validatePurchaseInvoiceEdit !== 'function') return;
  assert.equal(validatePurchaseInvoiceEdit({
    originalLines: editInvoiceLines,
    editedLines: [{ id: 41, product_id: 7, pieces: 3 }, editInvoiceLines[1]],
    returnLines: editInvoiceReturns,
  }), 'quantity_below_returned');
});
