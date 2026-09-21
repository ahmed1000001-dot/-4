(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Accounting = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PARTNERS = ['محمد إبراهيم', 'أحمد عبدالعظيم'];

  function number(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function calculatePartnerSummary({ expectedProfit = 0, otherIncome = 0, expenses = 0, withdrawals = [] } = {}) {
    const distributableProfit = round2(number(expectedProfit) + number(otherIncome) - number(expenses));
    const share = round2(distributableProfit / PARTNERS.length);
    const partners = {};

    PARTNERS.forEach((person) => {
      const withdrawn = round2(
        withdrawals
          .filter((item) => item && item.person === person)
          .reduce((total, item) => total + number(item.amount), 0),
      );
      partners[person] = {
        share,
        withdrawn,
        remaining: round2(share - withdrawn),
      };
    });

    return {
      distributableProfit,
      totalWithdrawals: round2(withdrawals.reduce((total, item) => total + number(item && item.amount), 0)),
      partners,
    };
  }

  function calculateSupplierBalance({ invoices = 0, payments = 0, returns = 0 } = {}) {
    return round2(number(invoices) - number(payments) - number(returns));
  }

  function inRange(date, from, to) {
    const value = String(date || '');
    return (!from || value >= from) && (!to || value <= to);
  }

  function calculateExpenseBreakdown(expenses = [], from = '', to = '') {
    const grouped = new Map();

    (Array.isArray(expenses) ? expenses : []).forEach((item) => {
      if (!item || !inRange(item.date, from, to)) return;
      const type = String(item.type || 'أخرى').trim() || 'أخرى';
      const current = grouped.get(type) || { type, count: 0, total: 0 };
      current.count += 1;
      current.total = round2(current.total + number(item.amount));
      grouped.set(type, current);
    });

    return Array.from(grouped.values()).sort(
      (a, b) => b.total - a.total || a.type.localeCompare(b.type, 'ar'),
    );
  }

  function calculateReportSummary({ actualSales = 0, otherIncome = 0, purchaseLines = [], marginLines = null, costLines = null, inventoryLines = [] } = {}) {
    let expectedSales = 0;
    let expectedProfit = 0;
    const costByProduct = {};

    const profitabilityLines = marginLines == null ? purchaseLines : marginLines;
    (Array.isArray(profitabilityLines) ? profitabilityLines : []).forEach((line) => {
      expectedSales += number(line && line.expected_sales);
      expectedProfit += number(line && line.expected_profit);
    });

    const valuationLines = costLines == null ? purchaseLines : costLines;
    (Array.isArray(valuationLines) ? valuationLines : []).forEach((line) => {
      const pieces = number(line && line.pieces);
      const purchaseTotal = number(line && line.purchase_total);
      if (line && line.product_id != null && pieces > 0) {
        const key = String(line.product_id);
        const current = costByProduct[key] || { cost: 0, pieces: 0 };
        current.cost += purchaseTotal;
        current.pieces += pieces;
        costByProduct[key] = current;
      }
    });

    const salesMargin = expectedSales > 0 ? expectedProfit / expectedSales : 0;
    const salesProfit = round2(number(actualSales) * salesMargin);
    const salesCost = round2(number(actualSales) - salesProfit);
    let inventorySaleValue = 0;
    let inventoryCost = 0;

    (Array.isArray(inventoryLines) ? inventoryLines : []).forEach((line) => {
      const qty = number(line && line.qty);
      const saleValue = line && line.value != null && line.value !== ''
        ? number(line.value)
        : qty * number(line && line.sale_price);
      const costData = line && line.product_id != null ? costByProduct[String(line.product_id)] : null;
      const costPerPiece = costData && costData.pieces > 0 ? costData.cost / costData.pieces : 0;
      inventorySaleValue += saleValue;
      inventoryCost += qty * costPerPiece;
    });

    inventorySaleValue = round2(inventorySaleValue);
    inventoryCost = round2(inventoryCost);
    const inventoryProfit = round2(inventorySaleValue - inventoryCost);
    const totalRevenue = round2(number(actualSales) + number(otherIncome));
    const totalSaleValue = round2(number(actualSales) + inventorySaleValue);
    const totalCost = round2(salesCost + inventoryCost);
    const salesProfitWithIncome = round2(salesProfit + number(otherIncome));

    return {
      expectedSales: round2(expectedSales),
      expectedProfit: round2(expectedProfit),
      salesMarginPercent: round2(salesMargin * 100),
      actualSales: round2(actualSales),
      otherIncome: round2(otherIncome),
      totalRevenue,
      salesCost,
      salesProfit,
      inventorySaleValue,
      inventoryCost,
      inventoryProfit,
      salesProfitWithIncome,
      totalSaleValue,
      totalCost,
      totalProfit: round2(salesProfitWithIncome + inventoryProfit),
    };
  }

  return {
    PARTNERS,
    calculatePartnerSummary,
    calculateSupplierBalance,
    calculateExpenseBreakdown,
    calculateReportSummary,
  };
});
