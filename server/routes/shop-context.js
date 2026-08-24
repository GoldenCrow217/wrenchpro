const express = require('express');
const router = express.Router();
const db = require('../database');
const { resolveShopId } = require('../tenant');

function publicShop(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || '',
    owner_email: row.owner_email || '',
    plan_status: row.plan_status || '',
    created_at: row.created_at || '',
  };
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

  const shop = db.prepare('SELECT id, name, owner_email, plan_status, created_at FROM shops WHERE id = ?').get(shopId);
  res.json({
    mode: 'shop',
    shop: publicShop(shop),
    membership: publicMembership(req.shopMembership),
  });
});

module.exports = router;
