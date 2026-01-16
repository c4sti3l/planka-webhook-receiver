import cron from 'node-cron';
import { getDb } from './database.js';
import { sendMail, getRecipients } from './mailer.js';

let cronJob = null;

export function getDigestSettings() {
  const db = getDb();
  return db.prepare('SELECT * FROM digest_settings LIMIT 1').get();
}

export function updateDigestSettings(intervalMinutes) {
  const db = getDb();
  db.prepare('UPDATE digest_settings SET interval_minutes = ? WHERE id = 1').run(intervalMinutes);

  // Restart cron job with new interval
  startDigestJob();
}

export function getEventFilters() {
  const db = getDb();
  return db.prepare('SELECT * FROM event_filters ORDER BY event_type').all();
}

export function updateEventFilter(eventType, enabled) {
  const db = getDb();
  return db.prepare('UPDATE event_filters SET enabled = ? WHERE event_type = ?')
    .run(enabled ? 1 : 0, eventType);
}

export function isEventEnabled(eventType) {
  const db = getDb();
  const filter = db.prepare('SELECT enabled FROM event_filters WHERE event_type = ?').get(eventType);
  return filter ? filter.enabled === 1 : false;
}

export function queueEvent(eventType, payload) {
  const db = getDb();
  db.prepare('INSERT INTO event_queue (event_type, payload) VALUES (?, ?)')
    .run(eventType, JSON.stringify(payload));
}

export function getQueuedEvents(limit = 100) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM event_queue
    WHERE processed = 0
    ORDER BY received_at DESC
    LIMIT ?
  `).all(limit);
}

export function getRecentEvents(limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM event_queue
    ORDER BY received_at DESC
    LIMIT ?
  `).all(limit);
}

export function markEventsProcessed(ids) {
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE event_queue SET processed = 1 WHERE id IN (${placeholders})`).run(...ids);
}

function formatEventForEmail(event) {
  const payload = JSON.parse(event.payload);
  const time = new Date(event.received_at).toLocaleString('de-DE');

  let title = event.event_type;
  let details = '';

  // Format based on event type
  switch (event.event_type) {
    case 'cardCreate':
      title = 'Card Created';
      details = `<strong>${payload.item?.name || 'Unknown'}</strong>`;
      if (payload.included?.lists?.[0]?.name) {
        details += ` in list <em>${payload.included.lists[0].name}</em>`;
      }
      break;
    case 'cardUpdate':
      title = 'Card Updated';
      details = `<strong>${payload.item?.name || 'Unknown'}</strong>`;
      break;
    case 'cardDelete':
      title = 'Card Deleted';
      details = `<strong>${payload.item?.name || 'Unknown'}</strong>`;
      break;
    case 'commentCreate':
      title = 'New Comment';
      details = `<strong>${payload.item?.text || ''}</strong>`;
      if (payload.included?.cards?.[0]?.name) {
        details += ` on card <em>${payload.included.cards[0].name}</em>`;
      }
      break;
    case 'cardMembershipCreate':
      title = 'Member Added to Card';
      if (payload.included?.users?.[0]?.name && payload.included?.cards?.[0]?.name) {
        details = `<strong>${payload.included.users[0].name}</strong> added to <em>${payload.included.cards[0].name}</em>`;
      }
      break;
    case 'attachmentCreate':
      title = 'Attachment Added';
      details = `<strong>${payload.item?.name || 'Unknown'}</strong>`;
      break;
    default:
      details = `Event: ${event.event_type}`;
  }

  return `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <strong>${title}</strong><br>
        <span style="color: #666;">${details}</span><br>
        <small style="color: #999;">${time}</small>
      </td>
    </tr>
  `;
}

async function processDigest() {
  const events = getQueuedEvents();

  if (events.length === 0) {
    return;
  }

  const recipients = getRecipients(true);

  if (recipients.length === 0) {
    console.log('No active recipients, skipping digest');
    return;
  }

  const eventRows = events.map(formatEventForEmail).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">
        Planka Activity Digest
      </h2>
      <p style="color: #666;">
        You have ${events.length} new notification${events.length > 1 ? 's' : ''}:
      </p>
      <table style="width: 100%; border-collapse: collapse;">
        ${eventRows}
      </table>
      <p style="color: #999; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
        This is an automated digest from your Planka Webhook Receiver.
      </p>
    </body>
    </html>
  `;

  const subject = `Planka Digest: ${events.length} new notification${events.length > 1 ? 's' : ''}`;
  const recipientEmails = recipients.map(r => r.email).join(', ');

  try {
    await sendMail(recipientEmails, subject, html);
    markEventsProcessed(events.map(e => e.id));

    // Update last sent time
    const db = getDb();
    db.prepare('UPDATE digest_settings SET last_sent_at = ? WHERE id = 1')
      .run(new Date().toISOString());

    console.log(`Digest sent to ${recipients.length} recipient(s) with ${events.length} event(s)`);
  } catch (error) {
    console.error('Failed to send digest:', error.message);
  }
}

export function startDigestJob() {
  // Stop existing job if any
  if (cronJob) {
    cronJob.stop();
  }

  const settings = getDigestSettings();
  const interval = settings.interval_minutes || 15;

  // Create cron expression for interval
  // Run every X minutes
  const cronExpression = `*/${interval} * * * *`;

  cronJob = cron.schedule(cronExpression, async () => {
    console.log('Running digest job...');
    await processDigest();
  });

  console.log(`Digest job started, running every ${interval} minutes`);
}

export async function triggerDigestNow() {
  await processDigest();
}
