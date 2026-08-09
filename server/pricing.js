const DEFAULT_PARTS_MARKUP_TIERS = Object.freeze([
  { up_to: 1, markup: 125 },
  { up_to: 5, markup: 75 },
  { up_to: 10, markup: 60 },
  { up_to: 25, markup: 45 },
  { up_to: 150, markup: 32.5 },
  { up_to: 300, markup: 30 },
  { up_to: 500, markup: 25 },
  { up_to: 1000, markup: 18 },
  { up_to: 5000, markup: 17.5 },
  { up_to: null, markup: 15 },
]);

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeMarkupTiers(value) {
  let tiers = value;
  if (value === undefined || value === null || value === '') {
    tiers = DEFAULT_PARTS_MARKUP_TIERS;
  } else if (typeof value === 'string') {
    try {
      tiers = JSON.parse(value);
    } catch {
      throw new TypeError('Parts markup tiers must be valid JSON');
    }
  }
  if (!Array.isArray(tiers) || tiers.length < 2) {
    throw new TypeError('Parts markup tiers must contain at least one price limit and an Above tier');
  }

  let previousLimit = 0;
  return tiers.map((tier, index) => {
    if (!tier || Array.isArray(tier) || typeof tier !== 'object') {
      throw new TypeError(`Parts markup tier ${index + 1} is invalid`);
    }
    const markup = Number(tier.markup);
    if (!Number.isFinite(markup) || markup < 0) {
      throw new TypeError(`Parts markup tier ${index + 1} must have a non-negative markup`);
    }
    const isLast = index === tiers.length - 1;
    if (isLast) {
      if (tier.up_to !== null) throw new TypeError('The final parts markup tier must be Above');
      return { up_to: null, markup };
    }
    const upTo = Number(tier.up_to);
    if (!Number.isFinite(upTo) || upTo <= previousLimit) {
      throw new TypeError('Parts markup price limits must be positive and strictly increasing');
    }
    previousLimit = upTo;
    return { up_to: upTo, markup };
  });
}

function markupForCost(cost, tiers = DEFAULT_PARTS_MARKUP_TIERS) {
  const numericCost = Number(cost);
  if (!Number.isFinite(numericCost) || numericCost < 0) return null;
  const normalized = normalizeMarkupTiers(tiers);
  return normalized.find(tier => tier.up_to === null || numericCost <= tier.up_to).markup;
}

function isTaxablePart(item) {
  return ['part', 'parts', 'shop_supply'].includes(String(item?.type || '').toLowerCase());
}

function calculateEstimateTotals(items = [], discount = 0, taxRate = 0) {
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const taxableParts = roundCurrency(items.filter(isTaxablePart).reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const safeDiscount = Math.max(0, Number(discount) || 0);
  const afterDiscount = roundCurrency(Math.max(0, subtotal - safeDiscount));
  const discountFactor = subtotal > 0 ? afterDiscount / subtotal : 0;
  const taxableAfterDiscount = roundCurrency(taxableParts * discountFactor);
  const tax = roundCurrency(taxableAfterDiscount * Math.max(0, Number(taxRate) || 0) / 100);
  return { subtotal, discount: safeDiscount, taxableParts, taxableAfterDiscount, tax, total: roundCurrency(afterDiscount + tax) };
}

module.exports = {
  DEFAULT_PARTS_MARKUP_TIERS,
  roundCurrency,
  normalizeMarkupTiers,
  markupForCost,
  calculateEstimateTotals,
};
