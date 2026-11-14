import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import {
  createNotification,
  logAudit,
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

// Public pharmacy directory & medicine catalog search
router.get('/', (_req, res) => {
  const db = getDb();
  const pharmacies = db
    .prepare(
      `SELECT ph.*,
        (SELECT COUNT(*) FROM medicines m WHERE m.pharmacy_id = ph.id AND m.stock_quantity > 0) as active_sku_count
       FROM pharmacies ph
       ORDER BY ph.verification_status DESC, ph.name ASC`
    )
    .all();
  res.json({ pharmacies });
});

router.get('/catalog', (req, res) => {
  const { search, category, pharmacy_id } = req.query as Record<string, string>;
  const db = getDb();

  let sql = `
    SELECT m.*, ph.name as pharmacy_name, ph.city as pharmacy_city, ph.is_24x7
    FROM medicines m
    JOIN pharmacies ph ON m.pharmacy_id = ph.id
    WHERE m.stock_quantity > 0
  `;
  const params: unknown[] = [];

  if (pharmacy_id && pharmacy_id !== 'all') {
    sql += ` AND m.pharmacy_id = ?`;
    params.push(Number(pharmacy_id));
  }
  if (category && category !== 'all') {
    sql += ` AND LOWER(m.category) = LOWER(?)`;
    params.push(category);
  }
  if (search) {
    sql += ` AND (LOWER(m.name) LIKE LOWER(?) OR LOWER(m.generic_name) LIKE LOWER(?) OR LOWER(m.category) LIKE LOWER(?))`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ` ORDER BY m.name ASC`;
  const medicines = db.prepare(sql).all(...params);
  res.json({ medicines });
});

function getPharmacyForUser(userId: number) {
  const db = getDb();
  return db.prepare('SELECT * FROM pharmacies WHERE user_id = ?').get(userId) as
    | Record<string, any>
    | undefined;
}

// Pharmacy Portal Dashboard
router.get('/dashboard', requireAuth, requireRole('pharmacy'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const pharmacy = getPharmacyForUser(req.user!.id);
  if (!pharmacy) {
    res.status(404).json({ error: 'Pharmacy profile not found.' });
    return;
  }

  const pharmacyId = Number(pharmacy.id);
  const medicines = db
    .prepare('SELECT * FROM medicines WHERE pharmacy_id = ? ORDER BY name ASC')
    .all(pharmacyId) as Array<Record<string, any>>;

  const nowPlus90 = new Date(Date.now() + 90 * 86400 * 1000).toISOString().slice(0, 10);
  const lowStockAlerts = medicines.filter((m) => m.stock_quantity <= m.reorder_level);
  const expiringAlerts = medicines.filter((m) => m.expiry_date <= nowPlus90);

  const orders = db
    .prepare(
      `SELECT mo.*, pu.full_name as patient_name, p.mrn, pu.phone as patient_phone,
              rx.diagnosis as rx_diagnosis, du.full_name as doctor_name
       FROM medicine_orders mo
       JOIN patients p ON mo.patient_id = p.id
       JOIN users pu ON p.user_id = pu.id
       LEFT JOIN prescriptions rx ON mo.prescription_id = rx.id
       LEFT JOIN doctors d ON rx.doctor_id = d.id
       LEFT JOIN users du ON d.user_id = du.id
       WHERE mo.pharmacy_id = ?
       ORDER BY mo.created_at DESC`
    )
    .all(pharmacyId) as Array<Record<string, any>>;

  for (const order of orders) {
    order.items = db.prepare('SELECT * FROM medicine_order_items WHERE order_id = ?').all(order.id);
    if (order.prescription_id) {
      order.prescription_items = db
        .prepare('SELECT * FROM prescription_items WHERE prescription_id = ?')
        .all(order.prescription_id);
    }
  }

  const paidSales = orders
    .filter((o) => o.payment_status === 'paid' && o.status !== 'rejected' && o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  res.json({
    pharmacy,
    stats: {
      total_skus: medicines.length,
      low_stock_count: lowStockAlerts.length,
      expiring_soon_count: expiringAlerts.length,
      pending_orders: orders.filter((o) => o.status === 'pending').length,
      total_sales: paidSales,
    },
    medicines,
    lowStockAlerts,
    expiringAlerts,
    orders,
  });
});

// Add Medicine to Inventory
router.post('/medicines', requireAuth, requireRole('pharmacy'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).max(160),
    generic_name: z.string().max(160).optional().default(''),
    category: z.string().min(2).max(80),
    manufacturer: z.string().max(120).optional().default(''),
    batch_number: z.string().max(60).optional().default(''),
    unit_price: z.coerce.number().min(0),
    stock_quantity: z.coerce.number().int().min(0),
    reorder_level: z.coerce.number().int().min(0).default(20),
    expiry_date: z.string().min(8).max(20),
    requires_prescription: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid medicine data', details: parsed.error.flatten() });
    return;
  }

  const pharmacy = getPharmacyForUser(req.user!.id);
  if (!pharmacy) {
    res.status(404).json({ error: 'Pharmacy not found.' });
    return;
  }

  const d = parsed.data;
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO medicines (pharmacy_id, name, generic_name, category, manufacturer, batch_number, unit_price, stock_quantity, reorder_level, expiry_date, requires_prescription)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      pharmacy.id,
      d.name,
      d.generic_name,
      d.category,
      d.manufacturer,
      d.batch_number,
      d.unit_price,
      d.stock_quantity,
      d.reorder_level,
      d.expiry_date,
      d.requires_prescription ? 1 : 0
    );

  const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ medicine });
});

// Update Medicine Stock / Price
router.patch('/medicines/:id', requireAuth, requireRole('pharmacy'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    unit_price: z.coerce.number().min(0).optional(),
    stock_quantity: z.coerce.number().int().min(0).optional(),
    reorder_level: z.coerce.number().int().min(0).optional(),
    expiry_date: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid update values' });
    return;
  }

  const pharmacy = getPharmacyForUser(req.user!.id);
  if (!pharmacy) {
    res.status(404).json({ error: 'Pharmacy not found.' });
    return;
  }

  const db = getDb();
  const med = db
    .prepare('SELECT * FROM medicines WHERE id = ? AND pharmacy_id = ?')
    .get(Number(req.params.id), pharmacy.id);
  if (!med) {
    res.status(404).json({ error: 'Medicine SKU not found.' });
    return;
  }

  const d = parsed.data;
  db.prepare(
    `UPDATE medicines SET
      unit_price = COALESCE(?, unit_price),
      stock_quantity = COALESCE(?, stock_quantity),
      reorder_level = COALESCE(?, reorder_level),
      expiry_date = COALESCE(?, expiry_date)
     WHERE id = ?`
  ).run(d.unit_price ?? null, d.stock_quantity ?? null, d.reorder_level ?? null, d.expiry_date ?? null, Number(req.params.id));

  const updated = db.prepare('SELECT * FROM medicines WHERE id = ?').get(Number(req.params.id));
  res.json({ medicine: updated });
});

// Verify / Process / Reject / Fulfill Order (Atomic Stock Deduction on Verify)
router.patch('/orders/:orderId/status', requireAuth, requireRole('pharmacy'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    status: z.enum(['verified', 'rejected', 'preparing', 'dispatched', 'delivered']),
    rejection_reason: z.string().max(300).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid order status' });
    return;
  }

  const pharmacy = getPharmacyForUser(req.user!.id);
  if (!pharmacy) {
    res.status(404).json({ error: 'Pharmacy not found.' });
    return;
  }

  const db = getDb();
  const orderId = Number(req.params.orderId);
  const order = db
    .prepare('SELECT * FROM medicine_orders WHERE id = ? AND pharmacy_id = ?')
    .get(orderId, pharmacy.id) as Record<string, any> | undefined;

  if (!order) {
    res.status(404).json({ error: 'Order not found for your pharmacy.' });
    return;
  }

  const nextStatus = parsed.data.status;

  try {
    db.transaction(() => {
      // Deduct inventory atomically when moving from pending -> verified or preparing (if not yet deducted)
      if (order.status === 'pending' && (nextStatus === 'verified' || nextStatus === 'preparing')) {
        const items = db
          .prepare('SELECT * FROM medicine_order_items WHERE order_id = ?')
          .all(orderId) as Array<{ medicine_id: number; medicine_name: string; quantity: number }>;

        for (const item of items) {
          const med = db
            .prepare('SELECT stock_quantity FROM medicines WHERE id = ?')
            .get(item.medicine_id) as { stock_quantity: number } | undefined;
          if (!med || med.stock_quantity < item.quantity) {
            throw new Error(`INSUFFICIENT_STOCK:${item.medicine_name}`);
          }
          db.prepare('UPDATE medicines SET stock_quantity = stock_quantity - ? WHERE id = ?').run(
            item.quantity,
            item.medicine_id
          );
        }
      }

      db.prepare(
        `UPDATE medicine_orders
         SET status = ?, rejection_reason = COALESCE(?, rejection_reason), updated_at = datetime('now')
         WHERE id = ?`
      ).run(nextStatus, parsed.data.rejection_reason ?? null, orderId);

      if (nextStatus === 'verified' && order.prescription_id) {
        db.prepare("UPDATE prescriptions SET status = 'dispensed' WHERE id = ?").run(order.prescription_id);
      }
    })();

    const patient = db.prepare('SELECT user_id FROM patients WHERE id = ?').get(order.patient_id) as { user_id: number };
    createNotification({
      userId: patient.user_id,
      title: `Medicine Order #${orderId} ${nextStatus.toUpperCase()}`,
      message:
        nextStatus === 'rejected'
          ? `${pharmacy.name} rejected your order: ${parsed.data.rejection_reason || 'Prescription check failed.'}`
          : `${pharmacy.name} updated your order status to ${nextStatus}.`,
      category: 'order',
      actionUrl: '/patient/orders',
    });

    logAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: `PHARMACY_ORDER_${nextStatus.toUpperCase()}`,
      resourceType: 'medicine_orders',
      resourceId: orderId,
      ipAddress: req.ip,
    });

    const updated = db.prepare('SELECT * FROM medicine_orders WHERE id = ?').get(orderId);
    res.json({ order: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.startsWith('INSUFFICIENT_STOCK:')) {
      res.status(409).json({ error: `Insufficient stock for ${msg.split(':')[1]}` });
      return;
    }
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

export default router;
