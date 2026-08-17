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
  const taxable = isTaxablePart({ type });
  return {
    ...item,
    type,
    qty,
    rate,
    amount: roundCurrency(qty * rate),
    taxable: taxable ? 1 : 0,
    inventory_id: taxable ? (item.inventory_id || null) : null,
  };
}

function normalizeLineItems(items = []) {
  return items.map(normalizeLineItem);
}

function lineItemTotals(items = []) {
  const totals = items.reduce((result, item) => {
    if (isTaxablePart(item)) result.parts = roundCurrency(result.parts + Number(item.amount || 0));
    else result.labor = roundCurrency(result.labor + Number(item.amount || 0));
    if (['labor', 'diagnostic'].includes(String(item.type || '').toLowerCase())) {
      result.laborHours += Number(item.qty || 0);
      result.laborServiceAmount = roundCurrency(result.laborServiceAmount + Number(item.amount || 0));
    }
    return result;
  }, { labor: 0, parts: 0, laborHours: 0, laborServiceAmount: 0 });
  totals.laborHours = Math.round((totals.laborHours + Number.EPSILON) * 1000) / 1000;
  totals.laborRate = totals.laborHours > 0 ? roundCurrency(totals.laborServiceAmount / totals.laborHours) : 0;
  delete totals.laborServiceAmount;
  return totals;
}

module.exports = { ALLOWED_ITEM_TYPES, normalizedItemType, normalizeLineItems, lineItemTotals };
