import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { ENV } from './server/config/env.ts';
import { getDb } from './server/db/database.ts';
import { initializeSchema } from './server/db/schema.ts';
import { seedDatabaseIfEmpty } from './server/db/seed.ts';
import { apiLimiter } from './server/middleware/auth.ts';

import authRoutes from './server/routes/auth.routes.ts';
import patientRoutes from './server/routes/patient.routes.ts';
import doctorRoutes from './server/routes/doctor.routes.ts';
import hospitalRoutes from './server/routes/hospital.routes.ts';
import pharmacyRoutes from './server/routes/pharmacy.routes.ts';
import appointmentRoutes from './server/routes/appointment.routes.ts';
import consultationRoutes from './server/routes/consultation.routes.ts';
import prescriptionRoutes from './server/routes/prescription.routes.ts';
import recordRoutes from './server/routes/record.routes.ts';
import orderRoutes from './server/routes/order.routes.ts';
import paymentRoutes from './server/routes/payment.routes.ts';
import notificationRoutes from './server/routes/notification.routes.ts';
import emergencyRoutes from './server/routes/emergency.routes.ts';
import adminRoutes from './server/routes/admin.routes.ts';
import aiRoutes from './server/routes/ai.routes.ts';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: ENV.CORS_ORIGIN === '*' ? true : ENV.CORS_ORIGIN.split(','),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '8mb' }));
  app.use('/api', apiLimiter);

  // Health & Platform Overview endpoint (real DB counts)
  app.get('/api/health', (_req, res) => {
    const db = getDb();
    const stats = {
      status: 'operational',
      verified_doctors: (db.prepare("SELECT COUNT(*) as c FROM doctors WHERE verification_status = 'verified'").get() as { c: number }).c,
      verified_hospitals: (db.prepare("SELECT COUNT(*) as c FROM hospitals WHERE verification_status = 'verified'").get() as { c: number }).c,
      verified_pharmacies: (db.prepare("SELECT COUNT(*) as c FROM pharmacies WHERE verification_status = 'verified'").get() as { c: number }).c,
      available_beds: (db.prepare("SELECT COUNT(*) as c FROM beds WHERE status = 'available'").get() as { c: number }).c,
    };
    res.json(stats);
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/patient', patientRoutes);
  app.use('/api/doctors', doctorRoutes);
  app.use('/api/hospitals', hospitalRoutes);
  app.use('/api/pharmacies', pharmacyRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/consultations', consultationRoutes);
  app.use('/api/prescriptions', prescriptionRoutes);
  app.use('/api/records', recordRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/emergency', emergencyRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/ai', aiRoutes);

  return app;
}

function attachWebRtcSignaling(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws/signaling' });
  const rooms = new Map<string, Set<WebSocket>>();

  wss.on('connection', (ws) => {
    let currentRoom: string | null = null;
    let currentRole = 'peer';

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          roomCode?: string;
          payload?: unknown;
          senderRole?: string;
          senderUid?: string;
        };

        if (msg.type === 'join' && msg.roomCode) {
          currentRoom = msg.roomCode;
          currentRole = msg.senderRole || 'peer';
          if (!rooms.has(currentRoom)) {
            rooms.set(currentRoom, new Set());
          }
          const peers = rooms.get(currentRoom)!;
          peers.add(ws);

          // Notify joining client how many peers are currently in the room
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'room-joined',
                roomCode: currentRoom,
                peerCount: peers.size,
              })
            );
          }

          for (const peer of peers) {
            if (peer !== ws && peer.readyState === WebSocket.OPEN) {
              peer.send(
                JSON.stringify({
                  type: 'peer-joined',
                  senderRole: currentRole,
                  senderUid: msg.senderUid || '',
                })
              );
            }
          }
          return;
        }

        if (currentRoom && rooms.has(currentRoom)) {
          for (const peer of rooms.get(currentRoom)!) {
            if (peer !== ws && peer.readyState === WebSocket.OPEN) {
              peer.send(JSON.stringify(msg));
            }
          }
        }
      } catch {
        // Ignore malformed signaling messages
      }
    });

    ws.on('close', () => {
      if (currentRoom && rooms.has(currentRoom)) {
        const peers = rooms.get(currentRoom)!;
        peers.delete(ws);
        for (const peer of peers) {
          if (peer.readyState === WebSocket.OPEN) {
            peer.send(JSON.stringify({ type: 'peer-left', senderRole: currentRole }));
          }
        }
        if (peers.size === 0) {
          rooms.delete(currentRoom);
        }
      }
    });
  });
}

async function startServer() {
  const db = getDb();
  initializeSchema(db);
  seedDatabaseIfEmpty(db);

  const app = createApp();
  const server = http.createServer(app);
  attachWebRtcSignaling(server);

  if (ENV.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(ENV.PORT, '0.0.0.0', () => {
    console.log(`CareOne Integrated Platform running on http://0.0.0.0:${ENV.PORT}`);
  });
}

// Only auto-start when executed directly (not imported by unit/integration tests)
if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  startServer().catch((err) => {
    console.error('Failed to start CareOne server:', err);
    process.exit(1);
  });
}
