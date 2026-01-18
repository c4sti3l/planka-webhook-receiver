import cron from 'node-cron';
import { getDb } from './database.js';
import { sendMail, getRecipients, getRecipientProjects } from './mailer.js';

let cronJob = null;

// German translations for event types
const EVENT_LABELS = {
  cardCreate: 'Karte erstellt',
  cardUpdate: 'Karte aktualisiert',
  cardDelete: 'Karte gelöscht',
  cardMove: 'Karte verschoben',
  cardLabelCreate: 'Label hinzugefügt',
  cardMembershipCreate: 'Mitglied hinzugefügt',
  cardMembershipDelete: 'Mitglied entfernt',
  commentCreate: 'Kommentar hinzugefügt',
  commentUpdate: 'Kommentar bearbeitet',
  commentDelete: 'Kommentar gelöscht',
  attachmentCreate: 'Anhang hinzugefügt',
  attachmentDelete: 'Anhang entfernt',
  listCreate: 'Liste erstellt',
  listUpdate: 'Liste aktualisiert',
  listDelete: 'Liste gelöscht',
  boardCreate: 'Board erstellt',
  boardUpdate: 'Board aktualisiert',
  notificationCreate: 'Benachrichtigung erstellt',
  notificationUpdate: 'Benachrichtigung aktualisiert',
  webhookUpdate: 'Webhook aktualisiert',
  webhookDelete: 'Webhook gelöscht',
  userUpdate: 'Benutzer aktualisiert'
};

export function getDigestSettings() {
  const db = getDb();
  return db.prepare('SELECT * FROM digest_settings LIMIT 1').get();
}

export function updateDigestSettings(intervalMinutes) {
  const db = getDb();
  db.prepare('UPDATE digest_settings SET interval_minutes = ? WHERE id = 1').run(intervalMinutes);
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

// Extract user email from event payload
function getTriggerUserEmail(payload) {
  return payload.user?.email ||
         payload.included?.users?.[0]?.email ||
         '';
}

// Extract readable data from payload
function extractEventInfo(payload) {
  const data = payload.data;
  const item = data?.item;
  const included = data?.included || {};

  // Find related entities
  const board = included.boards?.find(b => b.id === item?.boardId);
  const list = included.lists?.find(l => l.id === item?.listId);
  const project = included.projects?.find(p => p.id === board?.projectId);

  return {
    userName: payload.user?.name || payload.included?.users?.[0]?.name || 'Unbekannt',
    userEmail: getTriggerUserEmail(payload),
    cardName: item?.name || payload.item?.name || payload.included?.cards?.[0]?.name || '',
    boardName: board?.name || payload.included?.boards?.[0]?.name || '',
    listName: list?.name || payload.included?.lists?.[0]?.name || '',
    projectName: project?.name || '',
    comment: payload.item?.text || '',
    attachment: payload.item?.name || ''
  };
}

// Extract changes for cardUpdate events
function extractChanges(payload) {
  const dataItem = payload.data?.item;
  const prevItem = payload.prevData?.item;
  const includedNow = payload.data?.included || {};
  const includedPrev = payload.prevData?.included || {};

  if (!dataItem || !prevItem) {
    return [];
  }

  const resolveList = (id, source) => {
    const lists = source === 'prev' ? includedPrev.lists : includedNow.lists;
    return lists?.find(l => l.id === id)?.name || id;
  };

  const resolveBoard = (id, source) => {
    const boards = source === 'prev' ? includedPrev.boards : includedNow.boards;
    return boards?.find(b => b.id === id)?.name || id;
  };

  const fields = [
    { key: 'name', label: 'Titel' },
    { key: 'description', label: 'Beschreibung' },
    { key: 'listId', label: 'Spalte', map: resolveList },
    { key: 'boardId', label: 'Board', map: resolveBoard }
  ];

  return fields
    .map(f => {
      const beforeRaw = prevItem[f.key];
      const afterRaw = dataItem[f.key];

      if (beforeRaw === afterRaw) {
        return null;
      }

      return {
        label: f.label,
        before: f.map ? f.map(beforeRaw, 'prev') : beforeRaw,
        after: f.map ? f.map(afterRaw, 'now') : afterRaw
      };
    })
    .filter(Boolean);
}

// Format single event for email (German, user-friendly)
function formatEventForEmail(event) {
  const payload = JSON.parse(event.payload);
  const info = extractEventInfo(payload);

  const eventLabel = EVENT_LABELS[event.event_type] || event.event_type;
  const time = new Date(event.received_at).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) + ' Uhr';

  // Build details based on event type
  let details = '';
  if (event.event_type === 'commentCreate' && info.comment) {
    details = `<tr><td style="color: #666; padding: 2px 8px 2px 0;">Inhalt:</td><td>${info.comment.substring(0, 200)}${info.comment.length > 200 ? '...' : ''}</td></tr>`;
  }

  // Build changes diff table for cardUpdate
  let changesHtml = '';
  if (event.event_type === 'cardUpdate') {
    const changes = extractChanges(payload);
    if (changes.length > 0) {
      const changeRows = changes.map(c => `
        <tr>
          <td style="padding: 6px 10px; color: #6b7280; font-size: 12px; font-weight: 500; width: 100px; vertical-align: top;">${c.label}</td>
          <td style="padding: 6px 10px; color: #9ca3af; white-space: pre-wrap;">${c.before ?? '—'}</td>
          <td style="padding: 6px 10px; color: #374151; font-weight: 600; white-space: pre-wrap;">${c.after ?? '—'}</td>
        </tr>
      `).join('');

      changesHtml = `
        <table style="width: 100%; margin-top: 12px; border: 1px solid #e0e7ff; border-radius: 8px; border-collapse: separate; overflow: hidden; font-size: 13px;">
          <tbody>
            ${changeRows}
          </tbody>
        </table>
      `;
    }
  }

  return `
    <div style="border-left: 4px solid #6366f1; padding: 12px 16px; margin: 12px 0; background: #fafafa; border-radius: 0 8px 8px 0;">
      <div style="font-weight: 600; font-size: 15px; color: #1f2937; margin-bottom: 8px;">
        ${eventLabel}
      </div>
      <table style="font-size: 14px; color: #374151; line-height: 1.6;">
        ${info.cardName ? `<tr><td style="color: #666; padding: 2px 8px 2px 0; vertical-align: top;">Karte:</td><td><strong>${info.cardName}</strong></td></tr>` : ''}
        ${info.boardName ? `<tr><td style="color: #666; padding: 2px 8px 2px 0;">Board:</td><td>${info.boardName}</td></tr>` : ''}
        ${info.listName ? `<tr><td style="color: #666; padding: 2px 8px 2px 0;">Spalte:</td><td>${info.listName}</td></tr>` : ''}
        ${info.projectName ? `<tr><td style="color: #666; padding: 2px 8px 2px 0;">Projekt:</td><td>${info.projectName}</td></tr>` : ''}
        <tr><td style="color: #666; padding: 2px 8px 2px 0;">Von:</td><td>${info.userName}</td></tr>
        <tr><td style="color: #666; padding: 2px 8px 2px 0;">Datum:</td><td>${time}</td></tr>
        ${details}
      </table>
      ${changesHtml}
    </div>
  `;
}

// Generate digest HTML for a list of events
function generateDigestHtml(events, recipientName) {
  const eventHtml = events.map(formatEventForEmail).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f3f4f6;">
      <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h2 style="color: #1f2937; border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-top: 0;">
          Planka Aktivitäten
        </h2>
        ${recipientName ? `<p style="color: #6b7280; margin-bottom: 16px;">Hallo ${recipientName},</p>` : ''}
        <p style="color: #6b7280; margin-bottom: 20px;">
          ${events.length === 1 ? 'Es gibt eine neue Aktivität' : `Es gibt ${events.length} neue Aktivitäten`} in deinen Projekten:
        </p>
        ${eventHtml}
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          Diese E-Mail wurde automatisch von deinem Planka Webhook Receiver versendet.
        </p>
      </div>
    </body>
    </html>
  `;
}

async function processDigest() {
  const events = getQueuedEvents();

  if (events.length === 0) {
    return;
  }

  const recipients = getRecipients(true);

  if (recipients.length === 0) {
    console.log('[DIGEST] No active recipients, skipping');
    return;
  }

  console.log(`[DIGEST] Processing ${events.length} events for ${recipients.length} recipient(s)`);

  // Process each recipient separately (to filter out their own actions and by project access)
  for (const recipient of recipients) {
    // Get allowed projects for this recipient
    const allowedProjects = getRecipientProjects(recipient.id);
    const hasProjectRestriction = allowedProjects.length > 0;

    // Filter events: exclude own actions and filter by project access
    const relevantEvents = events.filter(event => {
      const payload = JSON.parse(event.payload);
      const triggerEmail = getTriggerUserEmail(payload);

      // If trigger email matches recipient email, skip this event for them
      if (triggerEmail && triggerEmail.toLowerCase() === recipient.email.toLowerCase()) {
        console.log(`[DIGEST] Skipping event for ${recipient.email} (own action)`);
        return false;
      }

      // Project-based filtering
      if (hasProjectRestriction) {
        const data = payload.data;
        const included = data?.included || {};
        const board = included.boards?.find(b => b.id === data?.item?.boardId);
        const project = included.projects?.find(p => p.id === board?.projectId);
        const projectId = project?.id;

        if (projectId && !allowedProjects.some(p => p.project_id === projectId)) {
          console.log(`[DIGEST] Skipping event for ${recipient.email} (no access to project ${project?.name})`);
          return false;
        }
      }

      return true;
    });

    if (relevantEvents.length === 0) {
      console.log(`[DIGEST] No relevant events for ${recipient.email}`);
      continue;
    }

    const subject = relevantEvents.length === 1
      ? 'Planka: Neue Aktivität'
      : `Planka: ${relevantEvents.length} neue Aktivitäten`;

    const html = generateDigestHtml(relevantEvents, recipient.name);

    try {
      await sendMail(recipient.email, subject, html);
      console.log(`[DIGEST] Sent ${relevantEvents.length} event(s) to ${recipient.email}`);
    } catch (error) {
      console.error(`[DIGEST] Failed to send to ${recipient.email}:`, error.message);
    }
  }

  // Mark all events as processed
  markEventsProcessed(events.map(e => e.id));

  // Update last sent time
  const db = getDb();
  db.prepare('UPDATE digest_settings SET last_sent_at = ? WHERE id = 1')
    .run(new Date().toISOString());

  console.log(`[DIGEST] Completed, marked ${events.length} event(s) as processed`);
}

export function startDigestJob() {
  if (cronJob) {
    cronJob.stop();
  }

  const settings = getDigestSettings();
  const interval = settings.interval_minutes || 15;

  const cronExpression = `*/${interval} * * * *`;

  cronJob = cron.schedule(cronExpression, async () => {
    console.log('[DIGEST] Running scheduled digest job...');
    await processDigest();
  });

  console.log(`[DIGEST] Job started, running every ${interval} minutes`);
}

export async function triggerDigestNow() {
  await processDigest();
}
