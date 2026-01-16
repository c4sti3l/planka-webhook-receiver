import { Router } from 'express';
import { isEventEnabled, queueEvent } from '../services/digest.js';

const router = Router();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Helper to extract data from Planka payload
function extractEventData(payload) {
  const data = {
    eventType: payload.type || payload.action || 'unknown',
    user: {
      name: payload.user?.name || payload.included?.users?.[0]?.name || 'Unknown',
      email: payload.user?.email || payload.included?.users?.[0]?.email || ''
    },
    card: {
      name: payload.item?.name || payload.included?.cards?.[0]?.name || '',
      id: payload.item?.id || payload.included?.cards?.[0]?.id || ''
    },
    board: {
      name: payload.included?.boards?.[0]?.name || '',
      id: payload.included?.boards?.[0]?.id || ''
    },
    list: {
      name: payload.included?.lists?.[0]?.name || '',
      id: payload.included?.lists?.[0]?.id || ''
    },
    comment: payload.item?.text || '',
    attachment: payload.item?.name || ''
  };

  return data;
}

router.post('/', (req, res) => {
  // Optional: Verify webhook secret
  if (WEBHOOK_SECRET) {
    const providedSecret = req.headers['x-webhook-secret'] || req.query.secret;
    if (providedSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
  }

  const payload = req.body;

  if (!payload) {
    console.log('[WEBHOOK] Empty payload received');
    return res.status(400).json({ error: 'Empty payload' });
  }

  // Extract structured data
  const eventData = extractEventData(payload);

  // Structured logging
  console.log('='.repeat(60));
  console.log(`[WEBHOOK] ${new Date().toISOString()}`);
  console.log(`  Event:  ${eventData.eventType}`);
  console.log(`  User:   ${eventData.user.name} (${eventData.user.email})`);
  console.log(`  Board:  ${eventData.board.name || '-'}`);
  console.log(`  List:   ${eventData.list.name || '-'}`);
  console.log(`  Card:   ${eventData.card.name || '-'}`);
  if (eventData.comment) {
    console.log(`  Comment: ${eventData.comment.substring(0, 50)}...`);
  }
  console.log('='.repeat(60));

  // Debug: Full payload (can be removed later)
  console.log('[DEBUG] Full payload:', JSON.stringify(payload, null, 2));

  if (eventData.eventType === 'unknown') {
    console.log('[WEBHOOK] Could not determine event type');
    return res.status(400).json({ error: 'Unknown event type', received: payload });
  }

  // Check if this event type is enabled
  const enabled = isEventEnabled(eventData.eventType);
  if (!enabled) {
    console.log(`[WEBHOOK] Event type ${eventData.eventType} not in filter, queuing anyway`);
  }

  // Queue the event
  queueEvent(eventData.eventType, payload);
  console.log(`[WEBHOOK] Event queued (filter enabled: ${enabled})`);

  res.json({ success: true, queued: true });
});

export default router;
