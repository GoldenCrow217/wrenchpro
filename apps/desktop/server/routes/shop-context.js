const express = require('express');
const router = express.Router();
const db = require('../database');
const { resolveShopId } = require('../tenant');

function canViewBillingContext(membership) {
  const role = String(membership?.role || '').trim().toLowerCase();
  return role === 'owner' || role === 'admin';
}

function publicShop(row, membership) {
  if (!row) return null;
  const visible = {
    id: row.id,
    name: row.name || '',
    plan_status: row.plan_status || '',
    trial_ends_at: row.trial_ends_at || '',
    created_at: row.created_at || '',
  };
  if (canViewBillingContext(membership)) {
    visible.owner_email = row.owner_email || '';
    visible.plan_code = row.plan_code || '';
    visible.billing_email = row.billing_email || '';
    visible.current_period_ends_at = row.current_period_ends_at || '';
  }
  return visible;
}

function publicMembership(row) {
  if (!row) return null;
  return {
    id: row.id,
    shop_id: row.shop_id,
    email: row.email || '',
    role: row.role || '',
    display_name: row.display_name || '',
    created_at: row.created_at || '',
  };
}

router.get('/', (req, res) => {
  const shopId = resolveShopId(req);
  if (!shopId) {
    return res.json({ mode: 'desktop', shop: null, membership: null });
  }

  const shop = db.prepare('SELECT id, name, owner_email, billing_email, plan_status, plan_code, trial_ends_at, current_period_ends_at, created_at FROM shops WHERE id = ?').get(shopId);
  res.json({
    mode: 'shop',
    shop: publicShop(shop, req.shopMembership),
    membership: publicMembership(req.shopMembership),
  });
});

module.exports = router;
