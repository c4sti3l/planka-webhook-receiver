import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api'

export const useSettingsStore = defineStore('settings', () => {
  const smtp = ref(null)
  const digest = ref(null)
  const recipients = ref([])
  const filters = ref([])
  const knownProjects = ref([])

  async function loadSmtp() {
    const response = await api.get('/settings/smtp')
    smtp.value = response.data
    return smtp.value
  }

  async function saveSmtp(settings) {
    await api.put('/settings/smtp', settings)
    await loadSmtp()
  }

  async function testSmtp(email) {
    return api.post('/settings/smtp/test', { email })
  }

  async function loadDigest() {
    const response = await api.get('/settings/digest')
    digest.value = response.data
    return digest.value
  }

  async function saveDigest(intervalMinutes) {
    await api.put('/settings/digest', { interval_minutes: intervalMinutes })
    await loadDigest()
  }

  async function triggerDigest() {
    return api.post('/settings/digest/trigger')
  }

  async function loadRecipients() {
    const response = await api.get('/settings/recipients')
    recipients.value = response.data
    return recipients.value
  }

  async function addRecipient(email, name) {
    await api.post('/settings/recipients', { email, name })
    await loadRecipients()
  }

  async function updateRecipient(id, email, name, active) {
    await api.put(`/settings/recipients/${id}`, { email, name, active })
    await loadRecipients()
  }

  async function deleteRecipient(id) {
    await api.delete(`/settings/recipients/${id}`)
    await loadRecipients()
  }

  async function loadFilters() {
    const response = await api.get('/settings/filters')
    filters.value = response.data
    return filters.value
  }

  async function updateFilter(eventType, enabled) {
    await api.put(`/settings/filters/${eventType}`, { enabled })
    await loadFilters()
  }

  async function loadKnownProjects() {
    const response = await api.get('/settings/projects')
    knownProjects.value = response.data
    return knownProjects.value
  }

  async function loadRecipientProjects(recipientId) {
    const response = await api.get(`/settings/recipients/${recipientId}/projects`)
    return response.data
  }

  async function addRecipientProject(recipientId, projectId, projectName) {
    await api.post(`/settings/recipients/${recipientId}/projects`, {
      project_id: projectId,
      project_name: projectName
    })
  }

  async function removeRecipientProject(recipientId, projectId) {
    await api.delete(`/settings/recipients/${recipientId}/projects/${projectId}`)
  }

  return {
    smtp,
    digest,
    recipients,
    filters,
    knownProjects,
    loadSmtp,
    saveSmtp,
    testSmtp,
    loadDigest,
    saveDigest,
    triggerDigest,
    loadRecipients,
    addRecipient,
    updateRecipient,
    deleteRecipient,
    loadFilters,
    updateFilter,
    loadKnownProjects,
    loadRecipientProjects,
    addRecipientProject,
    removeRecipientProject
  }
})
