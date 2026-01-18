import nodemailer from 'nodemailer';
import { getDb } from './database.js';

let transporter = null;

export function getSmtpSettings() {
  const db = getDb();
  return db.prepare('SELECT * FROM smtp_settings LIMIT 1').get();
}

export function updateSmtpSettings(settings) {
  const db = getDb();
  db.prepare(`
    UPDATE smtp_settings SET
      host = ?,
      port = ?,
      secure = ?,
      username = ?,
      password = ?,
      from_email = ?,
      from_name = ?
    WHERE id = 1
  `).run(
    settings.host,
    settings.port,
    settings.secure ? 1 : 0,
    settings.username,
    settings.password,
    settings.from_email,
    settings.from_name
  );

  // Reset transporter to use new settings
  transporter = null;
}

function createTransporter() {
  const settings = getSmtpSettings();

  if (!settings.host || !settings.from_email) {
    return null;
  }

  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure === 1,
    auth: settings.username ? {
      user: settings.username,
      pass: settings.password
    } : undefined
  });
}

export function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

export async function sendMail(to, subject, html) {
  const transport = getTransporter();
  if (!transport) {
    throw new Error('SMTP not configured');
  }

  const settings = getSmtpSettings();

  return transport.sendMail({
    from: `"${settings.from_name}" <${settings.from_email}>`,
    to,
    subject,
    html
  });
}

export async function sendTestMail(to) {
  return sendMail(
    to,
    'Planka Webhook Receiver - Test Email',
    `
    <h2>Test Email</h2>
    <p>This is a test email from your Planka Webhook Receiver.</p>
    <p>If you received this, your SMTP settings are configured correctly!</p>
    <p><small>Sent at: ${new Date().toISOString()}</small></p>
    `
  );
}

export function getRecipients(activeOnly = true) {
  const db = getDb();
  if (activeOnly) {
    return db.prepare('SELECT * FROM recipients WHERE active = 1').all();
  }
  return db.prepare('SELECT * FROM recipients').all();
}

export function addRecipient(email, name = null) {
  const db = getDb();
  return db.prepare('INSERT INTO recipients (email, name) VALUES (?, ?)').run(email, name);
}

export function updateRecipient(id, email, name, active) {
  const db = getDb();
  return db.prepare('UPDATE recipients SET email = ?, name = ?, active = ? WHERE id = ?')
    .run(email, name, active ? 1 : 0, id);
}

export function deleteRecipient(id) {
  const db = getDb();
  return db.prepare('DELETE FROM recipients WHERE id = ?').run(id);
}

// Recipient Projects Management
export function getRecipientProjects(recipientId) {
  const db = getDb();
  return db.prepare('SELECT * FROM recipient_projects WHERE recipient_id = ?').all(recipientId);
}

export function addRecipientProject(recipientId, projectId, projectName) {
  const db = getDb();
  return db.prepare(`
    INSERT OR IGNORE INTO recipient_projects (recipient_id, project_id, project_name)
    VALUES (?, ?, ?)
  `).run(recipientId, projectId, projectName);
}

export function removeRecipientProject(recipientId, projectId) {
  const db = getDb();
  return db.prepare('DELETE FROM recipient_projects WHERE recipient_id = ? AND project_id = ?')
    .run(recipientId, projectId);
}

export function getKnownProjects() {
  const db = getDb();
  // Extract unique projects from event payloads
  const events = db.prepare('SELECT payload FROM event_queue').all();
  const projectsMap = new Map();

  for (const event of events) {
    try {
      const payload = JSON.parse(event.payload);
      const included = payload.data?.included || {};
      const projects = included.projects || [];

      for (const project of projects) {
        if (project.id && project.name) {
          projectsMap.set(project.id, project.name);
        }
      }
    } catch (e) {
      // Skip invalid payloads
    }
  }

  return Array.from(projectsMap.entries()).map(([id, name]) => ({ id, name }));
}
