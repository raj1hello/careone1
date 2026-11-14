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

const createOrderSchema = z.object({
  pharmacy_id: z.coerce.number().int().positive(),
  prescription_id: z.coerce.number().int().positive().optional().nullable(),
  delivery_address: z.string().min(5).max(300),
  items: z
    .array(
      z.object({
        medicine_id: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1).max(100),
      })
    )
    .min(1),
});

router.get('/', requireAuth, requireRole('patient'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!patient) return void res.json({ orders: [] });

  const orders = db
    .prepare(
      `SELECT mo.*, ph.name as pharmacy_name, ph.phone as pharmacy_phone, ph.city as pharmacy_city
       FROM medicine_orders mo
       JOIN pharmacies ph ON mo.pharmacy_id = ph.id
       WHERE mo.patient_id = ?
       ORDER BY mo.created_at DESC`
    )
    .all(patient.id) as Array<Record<string, any>>;

  for (const order of orders) {
    order.items = db.prepare('SELECT * FROM medicine_order_items WHERE order_id = ?').all(order.id);
  }

  res.json({ orders });
});

router.post('/', requireAuth, requireRole('patient'), (req: AuthenticatedRequest, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid medicine order', details: parsed.error.flatten() });
    return;
  }

  const db = getDb();
  const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!patient) return void res.status(404).json({ error: 'Patient profile not found.' });

  const d = parsed.data;
  const pharmacy = db.prepare('SELECT id, user_id, name FROM pharmacies WHERE id = ?').get(d.pharmacy_id) as
    | { id: number; user_id: number; name: string }
    | undefined;
  if (!pharmacy) {
    res.status(404).json({ error: 'Selected pharmacy not found.' });
    return;
  }

  if (d.prescription_id) {
    const rx = db
      .prepare('SELECT id FROM prescriptions WHERE id = ? AND patient_id = ?')
      .get(d.prescription_id, patient.id);
    if (!rx) {
      res.status(403).json({ error: 'Referenced prescription does not belong to you.' });
      return;
    }
  }

  try {
    const orderId = db.transaction(() => {
      let totalAmount = 0;
      const resolvedItems: Array<{
        medicine_id: number;
        medicine_name: string;
        quantity: number;
        unit_price: number;
        subtotal: number;
      }> = [];

      for (const item of d.items) {
        const med = db
          .prepare('SELECT * FROM medicines WHERE id = ? AND pharmacy_id = ?')
          .get(item.medicine_id, pharmacy.id) as Record<string, any> | undefined;
        if (!med) {
          throw new Error('MED_NOT_FOUND');
        }
        if (med.stock_quantity < item.quantity) {
          throw new Error(`OUT_OF_STOCK:${med.name}`);
        }
        if (med.requires_prescription && !d.prescription_id) {
          throw new Error(`RX_REQUIRED:${med.name}`);
        }
        const subtotal = Number(med.unit_price) * item.quantity;
        totalAmount += subtotal;
        resolvedItems.push({
          medicine_id: med.id,
          medicine_name: med.name,
          quantity: item.quantity,
          unit_price: Number(med.unit_price),
          subtotal,
        });
      }

      const ordRes = db
        .prepare(
          `INSERT INTO medicine_orders (patient_id, pharmacy_id, prescription_id, status, delivery_address, total_amount, payment_status)
           VALUES (?, ?, ?, 'pending', ?, ?, 'unpaid')`
        )
        .run(patient.id, pharmacy.id, d.prescription_id ?? null, d.delivery_address, totalAmount);

      const newOrderId = Number(ordRes.lastInsertRowid);
      const insertItem = db.prepare(
        `INSERT INTO medicine_order_items (order_id, medicine_id, medicine_name, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const ri of resolvedItems) {
        insertItem.run(newOrderId, ri.medicine_id, ri.medicine_name, ri.quantity, ri.unit_price, ri.subtotal);
      }

      return newOrderId;
    })();

    createNotification({
      userId: pharmacy.user_id,
      title: `New Medicine Order #${orderId}`,
      message: `${req.user!.full_name} placed a new order awaiting prescription/stock verification.`,
      category: 'order',
      actionUrl: '/pharmacy/orders',
    });

    logAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'MEDICINE_ORDER_CREATED',
      resourceType: 'medicine_orders',
      resourceId: orderId,
      ipAddress: req.ip,
    });

    const order = db.prepare('SELECT * FROM medicine_orders WHERE id = ?').get(orderId) as Record<string, any>;
    order.items = db.prepare('SELECT * FROM medicine_order_items WHERE order_id = ?').all(orderId);
    res.status(201).json({ order });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'MED_NOT_FOUND') {
      res.status(404).json({ error: 'Medicine item not found in selected pharmacy.' });
      return;
    }
    if (msg.startsWith('OUT_OF_STOCK:')) {
      res.status(409).json({ error: `Insufficient stock for ${msg.split(':')[1]}` });
      return;
    }
    if (msg.startsWith('RX_REQUIRED:')) {
      res.status(400).json({ error: `Digital prescription required for ${msg.split(':')[1]}` });
      return;
    }
    res.status(500).json({ error: 'Failed to place medicine order.' });
  }
});

router.patch('/:id/cancel', requireAuth, requireRole('patient'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!patient) return void res.status(404).json({ error: 'Patient not found.' });

  const order = db
    .prepare('SELECT * FROM medicine_orders WHERE id = ? AND patient_id = ?')
    .get(Number(req.params.id), patient.id) as Record<string, any> | undefined;
  if (!order) return void res.status(404).json({ error: 'Order not found.' });
  if (order.status !== 'pending') {
    res.status(400).json({ error: 'Only pending orders can be cancelled.' });
    return;
  }

  db.prepare(`UPDATE medicine_orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(order.id);
  const updated = db.prepare('SELECT * FROM medicine_orders WHERE id = ?').get(order.id);
  res.json({ order: updated });
});

export default router;
