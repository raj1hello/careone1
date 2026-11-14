# Known Limitations & Pending External Integrations

1. **Runtime Stack Adaptation**: Because this AI Studio runtime provisions Node.js/TypeScript on port 3000 without Python `pip` or Django installed, the relational SQL backend is implemented in Express + TypeScript + `better-sqlite3` (instead of Python/Django + PostgreSQL). The normalized relational schema is directly portable to PostgreSQL.
2. **Razorpay Payment Gateway**: Checkout uses `razorpay_sandbox` mode when `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are unset, clearly labeled in the Invoices UI. Live Razorpay signature verification requires merchant credentials in `.env`.
3. **Background Queue (Redis / Celery)**: Notifications and reminder schedules currently run synchronously via SQLite and client polling rather than an external Redis/Celery worker cluster.
4. **WebRTC TURN Relay**: VidDoc video consultations use real browser `RTCPeerConnection` and local `/ws/signaling` WebSocket signaling with Google public STUN (`stun:stun.l.google.com:19302`). Production deployments across restrictive corporate NATs require a dedicated TURN server.
