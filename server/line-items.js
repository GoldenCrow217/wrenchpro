const { roundCurrency, isTaxablePart } = require('./pricing');

const ALLOWED_ITEM_TYPES = new Set(['labor', 'diagnostic', 'part', 'parts', 'shop_supply', 'fee', 'sublet']);

function normalizedItemType(type) {
  const normalized = String(type || 'labor').trim().toLowerCase();
  return ALLOWED_ITEM_TYPES.has(normalized) ? normalized : null;
}

function normalizeLineItem(item) {
  const type = normalizedItemType(item.type);
  const qty = Number(item.qty ?? 1);
  const rate = Number(item.rate ?? 0);
  return {
    ...item,
    type,
    qty,
    rate,
    amount: roundCurrency(qty * rate),
    taxable: isTaxablePart({ type }) ? 1 : 0,
  };
}

function normalizeLineItems(items = []) {
  return items.map(normalizeLineItem);
}

function lineItemTotals(items = []) {
  return items.reduce((totals, item) => {
    if (isTaxablePart(item)) totals.parts = roundCurrency(totals.parts + Number(item.amount || 0));
    else totals.labor = roundCurrency(totals.labor + Number(item.amount || 0));
    return totals;
  }, { labor: 0, parts: 0 });
}

module.exports = { ALLOWED_ITEM_TYPES, normalizedItemType, normalizeLineItems, lineItemTotals };
