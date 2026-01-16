import { Router } from 'express';
import { isEventEnabled, queueEvent } from '../services/digest.js';

const router = Router();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

router.post('/', (req, res) => {
  // Optional: Verify webhook secret
  if (WEBHOOK_SECRET) {
    const providedSecret = req.headers['x-webhook-secret'] || req.query.secret;
    if (providedSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
  }

  const payload = req.body;

  if (!payload || !payload.type) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  const eventType = payload.type;

  console.log(`Received webhook: ${eventType}`);

  // Check if this event type is enabled
  if (!isEventEnabled(eventType)) {
    console.log(`Event type ${eventType} is disabled, ignoring`);
    return res.json({ success: true, queued: false, reason: 'Event type disabled' });
  }

  // Queue the event for digest
  queueEvent(eventType, payload);
  console.log(`Event ${eventType} queued for digest`);

  res.json({ success: true, queued: true });
});

export default router;
