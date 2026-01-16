import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getRecentEvents, getQueuedEvents } from '../services/digest.js';

const router = Router();

router.use(authMiddleware);

router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const events = getRecentEvents(limit);

  // Parse payload JSON for each event
  const parsed = events.map(event => ({
    ...event,
    payload: JSON.parse(event.payload)
  }));

  res.json(parsed);
});

router.get('/pending', (req, res) => {
  const events = getQueuedEvents();
  res.json({ count: events.length });
});

export default router;
