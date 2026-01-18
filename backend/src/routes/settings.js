import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getSmtpSettings,
  updateSmtpSettings,
  getRecipients,
  addRecipient,
  updateRecipient,
  deleteRecipient,
  sendTestMail,
  getRecipientProjects,
  addRecipientProject,
  removeRecipientProject,
  getKnownProjects
} from '../services/mailer.js';
import {
  getDigestSettings,
  updateDigestSettings,
  getEventFilters,
  updateEventFilter,
  triggerDigestNow
} from '../services/digest.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// SMTP Settings
router.get('/smtp', (req, res) => {
  const settings = getSmtpSettings();
  // Don't send password in response
  res.json({
    ...settings,
    password: settings.password ? '********' : ''
  });
});

router.put('/smtp', (req, res) => {
  const { host, port, secure, username, password, from_email, from_name } = req.body;

  // Get current settings to preserve password if not changed
  const current = getSmtpSettings();

  updateSmtpSettings({
    host: host || '',
    port: port || 587,
    secure: secure || false,
    username: username || '',
    password: password === '********' ? current.password : (password || ''),
    from_email: from_email || '',
    from_name: from_name || 'Planka Notifications'
  });

  res.json({ success: true });
});

router.post('/smtp/test', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email address required' });
  }

  try {
    await sendTestMail(email);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Digest Settings
router.get('/digest', (req, res) => {
  const settings = getDigestSettings();
  res.json(settings);
});

router.put('/digest', (req, res) => {
  const { interval_minutes } = req.body;

  if (!interval_minutes || interval_minutes < 1) {
    return res.status(400).json({ error: 'Invalid interval' });
  }

  updateDigestSettings(interval_minutes);
  res.json({ success: true });
});

router.post('/digest/trigger', async (req, res) => {
  try {
    await triggerDigestNow();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recipients
router.get('/recipients', (req, res) => {
  const recipients = getRecipients(false);
  res.json(recipients);
});

router.post('/recipients', (req, res) => {
  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    const result = addRecipient(email, name);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/recipients/:id', (req, res) => {
  const { id } = req.params;
  const { email, name, active } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    updateRecipient(id, email, name, active);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/recipients/:id', (req, res) => {
  const { id } = req.params;
  deleteRecipient(id);
  res.json({ success: true });
});

// Recipient Projects
router.get('/recipients/:id/projects', (req, res) => {
  const { id } = req.params;
  const projects = getRecipientProjects(id);
  res.json(projects);
});

router.post('/recipients/:id/projects', (req, res) => {
  const { id } = req.params;
  const { project_id, project_name } = req.body;

  if (!project_id) {
    return res.status(400).json({ error: 'Project ID required' });
  }

  try {
    addRecipientProject(id, project_id, project_name);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/recipients/:id/projects/:projectId', (req, res) => {
  const { id, projectId } = req.params;
  removeRecipientProject(id, projectId);
  res.json({ success: true });
});

// Known Projects (extracted from events)
router.get('/projects', (req, res) => {
  const projects = getKnownProjects();
  res.json(projects);
});

// Event Filters
router.get('/filters', (req, res) => {
  const filters = getEventFilters();
  res.json(filters);
});

router.put('/filters/:eventType', (req, res) => {
  const { eventType } = req.params;
  const { enabled } = req.body;

  updateEventFilter(eventType, enabled);
  res.json({ success: true });
});

export default router;
