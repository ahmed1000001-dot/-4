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

  function calculateNetExpectedProfit(expectedProfit = 0, returnLines = [], from = '', to = '') {
    const returnedProfit = (Array.isArray(returnLines) ? returnLines : []).reduce((total, line) => {
      if (!line || line.purchase_line_id == null || !inRange(line.date, from, to)) return total;
      return total + number(line.qty) * number(line.unit_expected_profit);
    }, 0);
    return round2(number(expectedProfit) - returnedProfit);
  }

  function calculateAvailableReturnQty({ purchasedQty = 0, alreadyReturnedQty = 0, editingReturnQty = 0, otherDraftQty = 0 } = {}) {
    return Math.max(0, Math.floor(number(purchasedQty) - number(alreadyReturnedQty) + number(editingReturnQty) - number(otherDraftQty)));
  }

  function validatePurchaseInvoiceEdit({ originalLines = [], editedLines = [], returnLines = [], supplierChanged = false } = {}) {
    const originals = new Map((Array.isArray(originalLines) ? originalLines : []).map((line) => [String(line && line.id), line]));
    const edited = new Map((Array.isArray(editedLines) ? editedLines : [])
      .filter((line) => number(line && line.id) > 0)
      .map((line) => [String(line.id), line]));
    const returnedQtyByLine = new Map();

    (Array.isArray(returnLines) ? returnLines : []).forEach((line) => {
      if (!line || line.purchase_line_id == null) return;
      const key = String(line.purchase_line_id);
      returnedQtyByLine.set(key, number(returnedQtyByLine.get(key)) + Math.max(0, number(line.qty)));
    });

    if (supplierChanged && Array.from(returnedQtyByLine.values()).some((qty) => qty > 0)) return 'supplier_has_returns';

    for (const [lineId, returnedQty] of returnedQtyByLine.entries()) {
      if (returnedQty <= 0) continue;
      const original = originals.get(lineId);
      const next = edited.get(lineId);
      if (!original || !next) return 'returned_line_removed';
      if (number(next.product_id) !== number(original.product_id)) return 'returned_product_changed';
      if (number(next.pieces) < returnedQty) return 'quantity_below_returned';
    }

    return null;
  }

  function allocateSupplierReturnsByInvoice({ supplierReturns = [], supplierReturnLines = [], purchaseLines = [] } = {}) {
    const invoiceAmounts = {};
    const legacyBySupplier = {};
    const purchaseLineById = new Map((Array.isArray(purchaseLines) ? purchaseLines : []).map((line) => [String(line.id), line]));
    (Array.isArray(supplierReturns) ? supplierReturns : []).forEach((returnHeader) => {
      const details = (Array.isArray(supplierReturnLines) ? supplierReturnLines : [])
        .filter((line) => number(line && line.return_id) === number(returnHeader && returnHeader.id));
      const credit = number(returnHeader && returnHeader.amount);
      const addLegacy = () => {
        const supplierId = String(returnHeader && returnHeader.supplier_id);
        legacyBySupplier[supplierId] = round2(number(legacyBySupplier[supplierId]) + credit);
      };
      if (!details.length) {
        addLegacy();
        return;
      }

      const groups = new Map();
      for (const detail of details) {
        const purchase = purchaseLineById.get(String(detail && detail.purchase_line_id));
        if (!purchase) {
          addLegacy();
          return;
        }
        const invoiceId = String(purchase.invoice_id);
        const group = groups.get(invoiceId) || { costWeight: 0, qty: 0 };
        group.costWeight += number(detail.qty) * number(detail.unit_cost);
        group.qty += number(detail.qty);
        groups.set(invoiceId, group);
      }

      const entries = Array.from(groups.entries());
      const costWeight = entries.reduce((sum, [, group]) => sum + group.costWeight, 0);
      const totalWeight = costWeight > 0 ? costWeight : entries.reduce((sum, [, group]) => sum + group.qty, 0);
      let allocated = 0;
      entries.forEach(([invoiceId, group], index) => {
        const weight = costWeight > 0 ? group.costWeight : group.qty;
        const amount = index === entries.length - 1
          ? round2(credit - allocated)
          : round2(credit * weight / totalWeight);
        allocated += amount;
        invoiceAmounts[invoiceId] = round2(number(invoiceAmounts[invoiceId]) + amount);
      });
    });
    return { invoiceAmounts, legacyBySupplier };
  }

  function calculateNetPurchaseLines(purchaseLines = [], returnLines = [], throughDate = '') {
    const returnsByPurchaseLine = new Map();
    (Array.isArray(returnLines) ? returnLines : []).forEach((line) => {
      if (!line || line.purchase_line_id == null || (throughDate && String(line.date || '') > throughDate)) return;
      const key = String(line.purchase_line_id);
      const group = returnsByPurchaseLine.get(key) || [];
      group.push(line);
      returnsByPurchaseLine.set(key, group);
    });

    return (Array.isArray(purchaseLines) ? purchaseLines : []).map((line) => {
      const originalPieces = Math.max(0, number(line && line.pieces));
      const matchingReturns = returnsByPurchaseLine.get(String(line && line.id)) || [];
      const returnedQty = Math.min(originalPieces, matchingReturns.reduce((sum, item) => sum + Math.max(0, number(item.qty)), 0));
      const fallbackCostPerPiece = originalPieces > 0 ? number(line && line.purchase_total) / originalPieces : 0;
      const fallbackSalePerPiece = originalPieces > 0 ? number(line && line.expected_sales) / originalPieces : 0;
      const fallbackProfitPerPiece = originalPieces > 0 ? number(line && line.expected_profit) / originalPieces : 0;
      let returnedCost = 0;
      let returnedSales = 0;
      let returnedProfit = 0;
      let remainingQty = returnedQty;

      matchingReturns.forEach((item) => {
        if (remainingQty <= 0) return;
        const qty = Math.min(remainingQty, Math.max(0, number(item.qty)));
        returnedCost += qty * (item.unit_cost == null ? fallbackCostPerPiece : number(item.unit_cost));
        returnedSales += qty * (item.unit_sale_price == null ? fallbackSalePerPiece : number(item.unit_sale_price));
        returnedProfit += qty * (item.unit_expected_profit == null ? fallbackProfitPerPiece : number(item.unit_expected_profit));
        remainingQty -= qty;
      });

      return {
        ...line,
        pieces: Math.max(0, originalPieces - returnedQty),
        purchase_total: round2(Math.max(0, number(line && line.purchase_total) - returnedCost)),
        expected_sales: round2(Math.max(0, number(line && line.expected_sales) - returnedSales)),
        expected_profit: round2(number(line && line.expected_profit) - returnedProfit),
      };
    });
  }

  function calculateInventoryValuation(inventoryLines = [], netPurchaseLines = []) {
    const costByProduct = new Map();
    (Array.isArray(netPurchaseLines) ? netPurchaseLines : []).forEach((line) => {
      const pieces = Math.max(0, number(line && line.pieces));
      if (!line || line.product_id == null || pieces <= 0) return;
      const key = String(line.product_id);
      const current = costByProduct.get(key) || { cost: 0, pieces: 0 };
      current.cost += number(line.purchase_total);
      current.pieces += pieces;
      costByProduct.set(key, current);
    });

    const lines = (Array.isArray(inventoryLines) ? inventoryLines : []).map((line) => {
      const qty = Math.max(0, number(line && line.qty));
      const salePrice = number(line && line.sale_price);
      const saleValue = line && line.value != null && line.value !== ''
        ? number(line.value)
        : qty * salePrice;
      const cost = line && line.product_id != null ? costByProduct.get(String(line.product_id)) : null;
      const costKnown = Boolean(cost && cost.pieces > 0);
      const unitCost = costKnown ? cost.cost / cost.pieces : null;
      const costValue = costKnown ? round2(qty * unitCost) : null;
      const roundedSaleValue = round2(saleValue);
      return {
        product_id: line && line.product_id,
        product: line && line.product ? line.product : '',
        qty,
        costKnown,
        unitCost,
        costValue,
        unitSalePrice: salePrice,
        saleValue: roundedSaleValue,
        potentialProfit: costKnown ? round2(roundedSaleValue - costValue) : null,
      };
    });

    return {
      lines,
      totalCost: round2(lines.reduce((sum, line) => sum + number(line.costValue), 0)),
      totalSaleValue: round2(lines.reduce((sum, line) => sum + line.saleValue, 0)),
      totalPotentialProfit: round2(lines.reduce((sum, line) => sum + number(line.potentialProfit), 0)),
      unpricedLineCount: lines.filter((line) => line.qty > 0 && !line.costKnown).length,
      unpricedQty: lines.filter((line) => line.qty > 0 && !line.costKnown).reduce((sum, line) => sum + line.qty, 0),
    };
  }

  function calculatePartnerSummary({ expectedProfit = 0, supplierReturnLines = [], otherIncome = 0, expenses = 0, withdrawals = [] } = {}) {
    const netExpectedProfit = calculateNetExpectedProfit(expectedProfit, supplierReturnLines);
    const distributableProfit = round2(netExpectedProfit + number(otherIncome) - number(expenses));
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

  function calculateReportSummary({ actualSales = 0, otherIncome = 0, purchaseLines = [], marginLines = null, costLines = null, inventoryLines = [], supplierReturnLines = [], returnsThroughDate = '' } = {}) {
    let expectedSales = 0;
    let expectedProfit = 0;
    const costByProduct = {};

    const profitabilityInput = marginLines == null ? purchaseLines : marginLines;
    const profitabilityLines = Array.isArray(supplierReturnLines) && supplierReturnLines.length
      ? calculateNetPurchaseLines(profitabilityInput, supplierReturnLines, returnsThroughDate)
      : profitabilityInput;
    (Array.isArray(profitabilityLines) ? profitabilityLines : []).forEach((line) => {
      expectedSales += number(line && line.expected_sales);
      expectedProfit += number(line && line.expected_profit);
    });

    const valuationInput = costLines == null ? purchaseLines : costLines;
    const valuationLines = Array.isArray(supplierReturnLines) && supplierReturnLines.length
      ? calculateNetPurchaseLines(valuationInput, supplierReturnLines, returnsThroughDate)
      : valuationInput;
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
    calculateNetPurchaseLines,
    calculateNetExpectedProfit,
    calculateAvailableReturnQty,
    validatePurchaseInvoiceEdit,
    allocateSupplierReturnsByInvoice,
    calculateInventoryValuation,
    calculateReportSummary,
  };
});
