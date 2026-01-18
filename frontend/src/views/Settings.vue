<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-800 dark:text-white">Settings</h1>

    <!-- SMTP Settings -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">SMTP Configuration</h2>

      <form @submit.prevent="saveSmtp" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="label">SMTP Host</label>
            <input v-model="smtp.host" type="text" class="input" placeholder="smtp.example.com" />
          </div>
          <div>
            <label class="label">Port</label>
            <input v-model="smtp.port" type="number" class="input" placeholder="587" />
          </div>
          <div>
            <label class="label">Username</label>
            <input v-model="smtp.username" type="text" class="input" placeholder="Optional" />
          </div>
          <div>
            <label class="label">Password</label>
            <input v-model="smtp.password" type="password" class="input" placeholder="Optional" />
          </div>
          <div>
            <label class="label">From Email</label>
            <input v-model="smtp.from_email" type="email" class="input" placeholder="notifications@example.com" />
          </div>
          <div>
            <label class="label">From Name</label>
            <input v-model="smtp.from_name" type="text" class="input" placeholder="Planka Notifications" />
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <input v-model="smtp.secure" type="checkbox" id="secure" class="rounded text-indigo-600" />
          <label for="secure" class="text-sm text-gray-700 dark:text-neutral-400">Use TLS/SSL (port 465)</label>
        </div>

        <div class="flex space-x-2">
          <button type="submit" class="btn btn-primary" :disabled="savingSmtp">
            {{ savingSmtp ? 'Saving...' : 'Save SMTP Settings' }}
          </button>
          <button type="button" @click="testMail" class="btn btn-secondary" :disabled="testingMail">
            {{ testingMail ? 'Sending...' : 'Send Test Email' }}
          </button>
        </div>

        <div v-if="smtpMessage" :class="smtpError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'" class="text-sm">
          {{ smtpMessage }}
        </div>
      </form>
    </div>

    <!-- Digest Settings -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Digest Settings</h2>

      <form @submit.prevent="saveDigest" class="space-y-4">
        <div>
          <label class="label">Digest Interval (minutes)</label>
          <input v-model="digestInterval" type="number" min="1" max="1440" class="input w-32" />
          <p class="text-sm text-gray-600 dark:text-neutral-500 mt-1">
            Events are collected and sent as a digest email every {{ digestInterval }} minutes.
          </p>
        </div>

        <button type="submit" class="btn btn-primary" :disabled="savingDigest">
          {{ savingDigest ? 'Saving...' : 'Save Digest Settings' }}
        </button>
      </form>
    </div>

    <!-- Recipients -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Email Recipients</h2>

      <div class="space-y-4">
        <div class="flex space-x-2">
          <input v-model="newRecipient.email" type="email" class="input flex-1" placeholder="Email address" />
          <input v-model="newRecipient.name" type="text" class="input w-48" placeholder="Name (optional)" />
          <button @click="addRecipient" class="btn btn-primary" :disabled="!newRecipient.email">
            Add
          </button>
        </div>

        <div v-if="recipients.length === 0" class="text-gray-500 dark:text-neutral-500">
          No recipients configured. Add email addresses above.
        </div>

        <div v-else class="divide-y divide-gray-200 dark:divide-neutral-800">
          <div v-for="recipient in recipients" :key="recipient.id" class="py-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <input
                  type="checkbox"
                  :checked="recipient.active"
                  @change="toggleRecipient(recipient)"
                  class="rounded text-indigo-600"
                />
                <div>
                  <div class="font-medium text-gray-800 dark:text-white">{{ recipient.email }}</div>
                  <div v-if="recipient.name" class="text-sm text-gray-600 dark:text-neutral-500">{{ recipient.name }}</div>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <button
                  @click="openProjectsModal(recipient)"
                  class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                >
                  Projekte
                </button>
                <button @click="removeRecipient(recipient.id)" class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
                  Remove
                </button>
              </div>
            </div>
            <!-- Project badges -->
            <div v-if="recipientProjects[recipient.id]?.length" class="mt-2 ml-8 flex flex-wrap gap-1">
              <span
                v-for="project in recipientProjects[recipient.id]"
                :key="project.project_id"
                class="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded"
              >
                {{ project.project_name }}
              </span>
            </div>
            <div v-else class="mt-1 ml-8 text-xs text-gray-500 dark:text-neutral-500">
              Alle Projekte (keine Einschränkung)
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Projects Modal -->
    <div
      v-if="showProjectsModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeProjectsModal"
    >
      <div class="bg-white dark:bg-neutral-900 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Projekte für {{ selectedRecipient?.email }}
        </h3>

        <p class="text-sm text-gray-600 dark:text-neutral-400 mb-4">
          Wähle die Projekte aus, für die dieser Empfänger Benachrichtigungen erhalten soll.
          Ohne Auswahl werden alle Projekte benachrichtigt.
        </p>

        <div v-if="knownProjects.length === 0" class="text-gray-500 dark:text-neutral-500 text-sm">
          Keine Projekte gefunden. Projekte werden automatisch aus eingehenden Events erkannt.
        </div>

        <div v-else class="space-y-2">
          <label
            v-for="project in knownProjects"
            :key="project.id"
            class="flex items-center space-x-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <input
              type="checkbox"
              :checked="isProjectAssigned(project.id)"
              @change="toggleProject(project)"
              class="rounded text-indigo-600"
            />
            <span class="text-gray-800 dark:text-white">{{ project.name }}</span>
          </label>
        </div>

        <div class="mt-6 flex justify-end">
          <button @click="closeProjectsModal" class="btn btn-secondary">
            Schließen
          </button>
        </div>
      </div>
    </div>

    <!-- Change Password -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Change Admin Password</h2>

      <form @submit.prevent="changePassword" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="label">Current Password</label>
            <input v-model="passwords.current" type="password" class="input" />
          </div>
          <div>
            <label class="label">New Password</label>
            <input v-model="passwords.new" type="password" class="input" minlength="6" />
          </div>
        </div>

        <button type="submit" class="btn btn-primary" :disabled="changingPassword">
          {{ changingPassword ? 'Changing...' : 'Change Password' }}
        </button>

        <div v-if="passwordMessage" :class="passwordError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'" class="text-sm">
          {{ passwordMessage }}
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useAuthStore } from '../stores/auth'

const settingsStore = useSettingsStore()
const authStore = useAuthStore()

const smtp = reactive({
  host: '',
  port: 587,
  secure: false,
  username: '',
  password: '',
  from_email: '',
  from_name: 'Planka Notifications'
})

const digestInterval = ref(15)
const newRecipient = reactive({ email: '', name: '' })

const passwords = reactive({ current: '', new: '' })

const savingSmtp = ref(false)
const testingMail = ref(false)
const smtpMessage = ref('')
const smtpError = ref(false)

const savingDigest = ref(false)

const changingPassword = ref(false)
const passwordMessage = ref('')
const passwordError = ref(false)

const recipients = computed(() => settingsStore.recipients)
const knownProjects = computed(() => settingsStore.knownProjects)

const showProjectsModal = ref(false)
const selectedRecipient = ref(null)
const recipientProjects = ref({})

onMounted(async () => {
  const smtpData = await settingsStore.loadSmtp()
  Object.assign(smtp, smtpData)

  const digestData = await settingsStore.loadDigest()
  digestInterval.value = digestData.interval_minutes

  await settingsStore.loadRecipients()
  await settingsStore.loadKnownProjects()
  await loadAllRecipientProjects()
})

async function loadAllRecipientProjects() {
  for (const recipient of settingsStore.recipients) {
    recipientProjects.value[recipient.id] = await settingsStore.loadRecipientProjects(recipient.id)
  }
}

async function saveSmtp() {
  savingSmtp.value = true
  smtpMessage.value = ''
  try {
    await settingsStore.saveSmtp(smtp)
    smtpMessage.value = 'SMTP settings saved successfully'
    smtpError.value = false
  } catch (e) {
    smtpMessage.value = e.message
    smtpError.value = true
  } finally {
    savingSmtp.value = false
  }
}

async function testMail() {
  const email = prompt('Enter email address for test:')
  if (!email) return

  testingMail.value = true
  smtpMessage.value = ''
  try {
    await settingsStore.testSmtp(email)
    smtpMessage.value = 'Test email sent successfully'
    smtpError.value = false
  } catch (e) {
    smtpMessage.value = e.message
    smtpError.value = true
  } finally {
    testingMail.value = false
  }
}

async function saveDigest() {
  savingDigest.value = true
  try {
    await settingsStore.saveDigest(digestInterval.value)
  } finally {
    savingDigest.value = false
  }
}

async function addRecipient() {
  if (!newRecipient.email) return

  try {
    await settingsStore.addRecipient(newRecipient.email, newRecipient.name)
    newRecipient.email = ''
    newRecipient.name = ''
  } catch (e) {
    alert(e.message)
  }
}

async function toggleRecipient(recipient) {
  await settingsStore.updateRecipient(recipient.id, recipient.email, recipient.name, !recipient.active)
}

async function removeRecipient(id) {
  if (!confirm('Remove this recipient?')) return
  await settingsStore.deleteRecipient(id)
}

async function openProjectsModal(recipient) {
  selectedRecipient.value = recipient
  showProjectsModal.value = true
}

function closeProjectsModal() {
  showProjectsModal.value = false
  selectedRecipient.value = null
}

function isProjectAssigned(projectId) {
  const projects = recipientProjects.value[selectedRecipient.value?.id] || []
  return projects.some(p => p.project_id === projectId)
}

async function toggleProject(project) {
  if (!selectedRecipient.value) return

  const recipientId = selectedRecipient.value.id

  if (isProjectAssigned(project.id)) {
    await settingsStore.removeRecipientProject(recipientId, project.id)
  } else {
    await settingsStore.addRecipientProject(recipientId, project.id, project.name)
  }

  // Reload projects for this recipient
  recipientProjects.value[recipientId] = await settingsStore.loadRecipientProjects(recipientId)
}

async function changePassword() {
  if (!passwords.current || !passwords.new) return

  changingPassword.value = true
  passwordMessage.value = ''
  try {
    await authStore.changePassword(passwords.current, passwords.new)
    passwordMessage.value = 'Password changed successfully'
    passwordError.value = false
    passwords.current = ''
    passwords.new = ''
  } catch (e) {
    passwordMessage.value = e.message
    passwordError.value = true
  } finally {
    changingPassword.value = false
  }
}
</script>
