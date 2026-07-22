const express = require('express');
const router = express.Router();
const db = require('../database');
const { isAuthRequired, listMembershipsForUser } = require('../auth');

const SHOP_FIELDS = 'id, name, owner_email, plan_status, supabase_org_id, created_at';
const MEMBER_FIELDS = 'id, shop_id, email, role, display_name, created_at';
const VALID_MEMBER_ROLES = new Set(['owner', 'admin', 'advisor', 'mechanic']);
const VALID_PLAN_STATUSES = new Set(['trial', 'founding', 'active', 'past_due', 'canceled']);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeRole(value) {
  const role = String(value || 'mechanic').trim().toLowerCase();
  return VALID_MEMBER_ROLES.has(role) ? role : null;
}

function normalizePlanStatus(value) {
  const status = String(value || 'trial').trim().toLowerCase();
  return VALID_PLAN_STATUSES.has(status) ? status : 'trial';
}

function requestedPlanStatus(req, fallback = 'trial') {
  // In hosted SaaS mode, billing/plan state must not be self-service mutable
  // through the shop profile endpoint. Owners can manage shop identity and
  // team access here; Stripe/admin tooling should own plan_status later.
  if (isAuthRequired()) return normalizePlanStatus(fallback);
  return normalizePlanStatus(req.body?.plan_status || fallback);
}

function activeMembership(req) {
  return req.shopMembership || null;
}

function isManagerRole(membership) {
  return membership && ['owner', 'admin'].includes(membership.role);
}

function canManageShop(req) {
  return isManagerRole(activeMembership(req));
}

function isOwnerRole(membership) {
  return membership && membership.role === 'owner';
}

function requireOwnerForOwnerMembershipChanges(req, res, memberRole) {
  // Admins can manage day-to-day staff, but only an owner should be able to
  // create, promote, demote, edit, or remove owner-level access in hosted SaaS.
  // Local desktop mode stays permissive because there is no authenticated actor.
  if (!isAuthRequired()) return true;
  if (memberRole !== 'owner') return true;
  if (isOwnerRole(activeMembership(req))) return true;
  res.status(403).json({ error: 'Owner role required for owner membership changes' });
  return false;
}

function existingMembershipForEmail(shopId, email, excludeMemberId = null) {
  const params = [shopId, normalizeEmail(email)];
  let excludeClause = '';
  if (excludeMemberId) {
    excludeClause = ' AND id <> ?';
    params.push(excludeMemberId);
  }
  return db.prepare(`
    SELECT ${MEMBER_FIELDS}
    FROM shop_memberships
    WHERE shop_id = ? AND lower(email) = ?${excludeClause}
    LIMIT 1
  `).get(...params) || null;
}

function userHasAnyManagedShop(req) {
  if (!isAuthRequired()) return true;
  return listMembershipsForUser(req.authUser).some(isManagerRole);
}

function linkLegacyLocalWorkspaceToShop(shopId) {
  if (!shopId || isAuthRequired()) return;

  // Local desktop installs can have useful pre-SaaS data with NULL shop_id.
  // When the user creates their first local shop from Settings, link that
  // legacy workspace instead of making customers/jobs disappear behind the new
  // tenant filter. Hosted auth mode never runs this path.
  const legacyTables = [
    'customers',
    'expenses',
    'employees',
    'appointments',
    'parts_inventory',
    'service_catalog',
    'leads',
  ];
  for (const table of legacyTables) {
    db.prepare(`UPDATE ${table} SET shop_id = ? WHERE shop_id IS NULL`).run(shopId);
  }

  const globalSettings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  if (globalSettings) {
    db.prepare(`
      INSERT OR IGNORE INTO shop_settings (
        shop_id, business_name, owner_name, phone, email, address, service_area, website, business_hours,
        default_labor_rate, diagnostic_rate, fleet_rate, emergency_rate, service_fee,
        default_pay_method, tax_rate, oil_warn_miles, currency_symbol,
        tax_id, invoice_terms, invoice_footer, invoice_logo,
        warranty_terms, estimate_terms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      shopId,
      globalSettings.business_name || '', globalSettings.owner_name || '', globalSettings.phone || '',
      globalSettings.email || '', globalSettings.address || '', globalSettings.service_area || '',
      globalSettings.website || '', globalSettings.business_hours || '',
      globalSettings.default_labor_rate || 0, globalSettings.diagnostic_rate || 0, globalSettings.fleet_rate || 0,
      globalSettings.emergency_rate || 0, globalSettings.service_fee || 0,
      globalSettings.default_pay_method || 'Cash', globalSettings.tax_rate || 0,
      globalSettings.oil_warn_miles || 1500, globalSettings.currency_symbol || '$',
      globalSettings.tax_id || '', globalSettings.invoice_terms || 'Due on receipt',
      globalSettings.invoice_footer || 'Thank you for your business!', globalSettings.invoice_logo || '',
      globalSettings.warranty_terms || '12 months / 12,000 miles', globalSettings.estimate_terms || ''
    );
  }
}

function enforceHostedShopAccess(req, res, shopId, { manage = false } = {}) {
  if (!isAuthRequired()) return true;

  const membership = activeMembership(req);
  if (!membership || Number(membership.shop_id) !== Number(shopId)) {
    res.status(404).json({ error: 'Shop not found' });
    return false;
  }
  if (manage && !canManageShop(req)) {
    res.status(403).json({ error: 'Owner or admin role required' });
    return false;
  }
  return true;
}

router.get('/', (req, res) => {
  if (isAuthRequired()) {
    const memberships = listMembershipsForUser(req.authUser);
    if (!memberships.length) return res.json([]);

    const placeholders = memberships.map(() => '?').join(',');
    const shops = db.prepare(`
      SELECT ${SHOP_FIELDS}
      FROM shops
      WHERE id IN (${placeholders})
      ORDER BY created_at DESC
    `).all(...memberships.map(m => m.shop_id));
    return res.json(shops);
  }

  const shops = db.prepare(`SELECT ${SHOP_FIELDS} FROM shops ORDER BY created_at DESC`).all();
  res.json(shops);
});

router.post('/', (req, res) => {
  const existingMemberships = isAuthRequired() ? listMembershipsForUser(req.authUser) : [];
  if (isAuthRequired() && existingMemberships.length > 0 && !userHasAnyManagedShop(req)) {
    return res.status(403).json({ error: 'Owner or admin role required' });
  }

  const { name, owner_email, plan_status } = req.body;
  const cleanName = String(name || '').trim();
  const cleanOwnerEmail = isAuthRequired()
    ? normalizeEmail(req.authUser?.email)
    : normalizeEmail(owner_email);
  if (!cleanName) return res.status(400).json({ error: 'Shop name is required' });
  if (isAuthRequired() && !cleanOwnerEmail) return res.status(400).json({ error: 'Authenticated user email is required to create a shop' });
  if (cleanOwnerEmail && !isValidEmail(cleanOwnerEmail)) return res.status(400).json({ error: 'Owner email is invalid' });

  const createShop = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO shops (name, owner_email, plan_status)
      VALUES (?, ?, ?)
    `).run(cleanName, cleanOwnerEmail, requestedPlanStatus(req));
    const shop = db.prepare(`SELECT ${SHOP_FIELDS} FROM shops WHERE id = ?`).get(result.lastInsertRowid);

    if (isAuthRequired()) {
      db.prepare(`
        INSERT INTO shop_memberships (shop_id, email, role, display_name, supabase_user_id)
        VALUES (?, ?, 'owner', ?, ?)
      `).run(
        shop.id,
        cleanOwnerEmail,
        req.authUser?.email || cleanOwnerEmail,
        req.authUser?.id || ''
      );
    } else {
      linkLegacyLocalWorkspaceToShop(shop.id);
    }

    return shop;
  });

  const shop = createShop();
  res.json(shop);
});

router.put('/:id', (req, res) => {
  const { name, owner_email, plan_status } = req.body;
  const cleanName = String(name || '').trim();
  const cleanOwnerEmail = normalizeEmail(owner_email);
  if (!cleanName) return res.status(400).json({ error: 'Shop name is required' });
  if (cleanOwnerEmail && !isValidEmail(cleanOwnerEmail)) return res.status(400).json({ error: 'Owner email is invalid' });

  const existing = db.prepare('SELECT id, plan_status FROM shops WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Shop not found' });
  if (!enforceHostedShopAccess(req, res, req.params.id, { manage: true })) return;

  db.prepare(`
    UPDATE shops
    SET name = ?, owner_email = ?, plan_status = ?
    WHERE id = ?
  `).run(cleanName, cleanOwnerEmail, requestedPlanStatus(req, existing.plan_status), req.params.id);
  const shop = db.prepare(`SELECT ${SHOP_FIELDS} FROM shops WHERE id = ?`).get(req.params.id);
  res.json(shop);
});

router.get('/:id/memberships', (req, res) => {
  const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (!enforceHostedShopAccess(req, res, req.params.id, { manage: true })) return;

  const members = db.prepare(`SELECT ${MEMBER_FIELDS} FROM shop_memberships WHERE shop_id = ? ORDER BY role, email`).all(req.params.id);
  res.json(members);
});

router.post('/:id/memberships', (req, res) => {
  const { email, role, display_name } = req.body;
  const cleanEmail = normalizeEmail(email);
  const cleanRole = normalizeRole(role);
  if (!cleanEmail) return res.status(400).json({ error: 'Member email is required' });
  if (!isValidEmail(cleanEmail)) return res.status(400).json({ error: 'Member email is invalid' });
  if (!cleanRole) return res.status(400).json({ error: 'Member role is invalid' });

  const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (!enforceHostedShopAccess(req, res, req.params.id, { manage: true })) return;

  if (!requireOwnerForOwnerMembershipChanges(req, res, cleanRole)) return;

  if (existingMembershipForEmail(req.params.id, cleanEmail)) {
    return res.status(409).json({ error: 'Member already exists for this shop' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO shop_memberships (shop_id, email, role, display_name)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, cleanEmail, cleanRole, String(display_name || '').trim());
    const member = db.prepare(`SELECT ${MEMBER_FIELDS} FROM shop_memberships WHERE id = ?`).get(result.lastInsertRowid);
    res.json(member);
  } catch (error) {
    if (error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Member already exists for this shop' });
    }
    throw error;
  }
});

router.put('/:id/memberships/:memberId', (req, res) => {
  const { email, role, display_name } = req.body;
  const cleanEmail = normalizeEmail(email);
  const cleanRole = normalizeRole(role);
  if (!cleanEmail) return res.status(400).json({ error: 'Member email is required' });
  if (!isValidEmail(cleanEmail)) return res.status(400).json({ error: 'Member email is invalid' });
  if (!cleanRole) return res.status(400).json({ error: 'Member role is invalid' });

  const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (!enforceHostedShopAccess(req, res, req.params.id, { manage: true })) return;

  const member = db.prepare(`SELECT ${MEMBER_FIELDS}, supabase_user_id FROM shop_memberships WHERE id = ? AND shop_id = ?`).get(req.params.memberId, req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  if (!requireOwnerForOwnerMembershipChanges(req, res, member.role)) return;
  if (!requireOwnerForOwnerMembershipChanges(req, res, cleanRole)) return;

  if (member.supabase_user_id && cleanEmail !== normalizeEmail(member.email)) {
    return res.status(400).json({ error: 'Supabase-linked member email cannot be changed' });
  }

  if (existingMembershipForEmail(req.params.id, cleanEmail, req.params.memberId)) {
    return res.status(409).json({ error: 'Member already exists for this shop' });
  }

  if (member.role === 'owner' && cleanRole !== 'owner') {
    const ownerCount = db.prepare("SELECT COUNT(*) as count FROM shop_memberships WHERE shop_id = ? AND role = 'owner'").get(req.params.id).count;
    if (ownerCount <= 1) return res.status(400).json({ error: 'At least one shop owner is required' });
  }

  try {
    db.prepare(`
      UPDATE shop_memberships
      SET email = ?, role = ?, display_name = ?
      WHERE id = ? AND shop_id = ?
    `).run(cleanEmail, cleanRole, String(display_name || '').trim(), req.params.memberId, req.params.id);
    const updated = db.prepare(`SELECT ${MEMBER_FIELDS} FROM shop_memberships WHERE id = ? AND shop_id = ?`).get(req.params.memberId, req.params.id);
    return res.json(updated);
  } catch (error) {
    if (error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Member already exists for this shop' });
    }
    throw error;
  }
});

router.delete('/:id/memberships/:memberId', (req, res) => {
  const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (!enforceHostedShopAccess(req, res, req.params.id, { manage: true })) return;

  const member = db.prepare(`SELECT ${MEMBER_FIELDS} FROM shop_memberships WHERE id = ? AND shop_id = ?`).get(req.params.memberId, req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (!requireOwnerForOwnerMembershipChanges(req, res, member.role)) return;

  if (member.role === 'owner') {
    const ownerCount = db.prepare("SELECT COUNT(*) as count FROM shop_memberships WHERE shop_id = ? AND role = 'owner'").get(req.params.id).count;
    if (ownerCount <= 1) return res.status(400).json({ error: 'At least one shop owner is required' });
  }

  db.prepare('DELETE FROM shop_memberships WHERE id = ? AND shop_id = ?').run(req.params.memberId, req.params.id);
  res.json({ ok: true, id: member.id });
});

module.exports = router;
