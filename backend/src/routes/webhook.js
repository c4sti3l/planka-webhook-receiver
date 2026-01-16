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

  // Debug: Log full payload to see what Planka sends
  console.log('=== INCOMING WEBHOOK ===');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(payload, null, 2));
  console.log('========================');

  // Try to extract event type from various formats
  // Planka might use: action, type, event, or nested structure
  const eventType = payload.type || payload.action || payload.event ||
                    (payload.data && payload.data.type) || 'unknown';

  if (!payload || eventType === 'unknown') {
    console.log('Could not determine event type from payload');
    return res.status(400).json({ error: 'Invalid webhook payload', received: payload });
  }

  console.log(`Received webhook: ${eventType}`);

  // Check if this event type is enabled (but always queue for debugging)
  const enabled = isEventEnabled(eventType);
  if (!enabled) {
    console.log(`Event type ${eventType} is not in filter list, queuing anyway for debug`);
  }

  // Queue the event for digest (always queue to see what's coming in)
  queueEvent(eventType, payload);
  console.log(`Event ${eventType} queued for digest (enabled: ${enabled})`);

  res.json({ success: true, queued: true });
});

export default router;
