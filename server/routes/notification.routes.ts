import { Router } from 'express';
import { getDb } from '../db/database.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const notifications = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 40')
    .all(req.user!.id);
  const unreadCount = (
    db
      .prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0')
      .get(req.user!.id) as { cnt: number }
  ).cnt;
  res.json({ notifications, unreadCount });
});

router.patch('/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
    Number(req.params.id),
    req.user!.id
  );
  res.json({ ok: true });
});

router.post('/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
  res.json({ ok: true });
});

export default router;
