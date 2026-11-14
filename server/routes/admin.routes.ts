import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import { logAudit, requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

router.get('/audit-logs', requireAuth, requireRole('admin'), (_req, res) => {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
  res.json({ logs });
});

router.patch('/verify/:entity/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({ status: z.enum(['verified', 'rejected']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const db = getDb();
  const { entity, id } = req.params;
  const numId = Number(id);

  if (entity === 'hospital') {
    db.prepare('UPDATE hospitals SET verification_status = ? WHERE id = ?').run(parsed.data.status, numId);
  } else if (entity === 'pharmacy') {
    db.prepare('UPDATE pharmacies SET verification_status = ? WHERE id = ?').run(parsed.data.status, numId);
  } else if (entity === 'doctor') {
    db.prepare('UPDATE doctors SET verification_status = ? WHERE id = ?').run(parsed.data.status, numId);
  } else {
    res.status(400).json({ error: 'Unknown entity type.' });
    return;
  }

  logAudit({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: `ADMIN_VERIFIED_${entity.toUpperCase()}`,
    resourceType: entity,
    resourceId: numId,
    ipAddress: req.ip,
  });

  res.json({ updated: true, status: parsed.data.status });
});

export default router;
