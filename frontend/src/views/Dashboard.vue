<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
      <div class="flex items-center space-x-4">
        <span class="text-sm text-gray-600 dark:text-neutral-500">
          {{ pendingCount }} pending event{{ pendingCount !== 1 ? 's' : '' }}
        </span>
        <button @click="triggerDigest" class="btn btn-secondary text-sm" :disabled="triggering">
          {{ triggering ? 'Sending...' : 'Send Digest Now' }}
        </button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="card">
        <div class="text-sm text-gray-600 dark:text-neutral-500">Pending Events</div>
        <div class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{{ pendingCount }}</div>
      </div>
      <div class="card">
        <div class="text-sm text-gray-600 dark:text-neutral-500">Digest Interval</div>
        <div class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{{ digestInterval }} min</div>
      </div>
      <div class="card">
        <div class="text-sm text-gray-600 dark:text-neutral-500">Active Recipients</div>
        <div class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{{ activeRecipients }}</div>
      </div>
    </div>

    <!-- Webhook URL Info -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">Webhook URL</h2>
      <div class="flex items-center space-x-2">
        <code class="flex-1 bg-gray-100 dark:bg-neutral-800 px-3 py-2 rounded text-sm text-gray-800 dark:text-neutral-300">
          {{ webhookUrl }}
        </code>
        <button @click="copyUrl" class="btn btn-secondary text-sm">
          {{ copied ? 'Copied!' : 'Copy' }}
        </button>
      </div>
      <p class="text-sm text-gray-600 dark:text-neutral-500 mt-2">
        Configure this URL in your Planka webhook settings.
      </p>
    </div>

    <!-- Recent Events -->
    <div class="card">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">Recent Events</h2>
        <button @click="loadEvents" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm">
          Refresh
        </button>
      </div>

      <div v-if="loading" class="text-gray-500 dark:text-neutral-500">Loading...</div>

      <div v-else-if="events.length === 0" class="text-gray-500 dark:text-neutral-500">
        No events yet. Configure the webhook in Planka to start receiving events.
      </div>

      <div v-else class="space-y-2 max-h-96 overflow-y-auto">
        <div
          v-for="event in events"
          :key="event.id"
          class="border-l-4 pl-3 py-2 rounded-r"
          :class="event.processed
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
            : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'"
        >
          <div class="flex justify-between">
            <span class="font-medium text-gray-800 dark:text-white">{{ formatEventType(event.event_type) }}</span>
            <span
              class="text-xs"
              :class="event.processed ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'"
            >
              {{ event.processed ? 'Sent' : 'Pending' }}
            </span>
          </div>
          <div class="text-sm text-gray-600 dark:text-neutral-500">
            {{ formatEventDetails(event) }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-500">
            {{ formatDate(event.received_at) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { api } from '../api'
import { useSettingsStore } from '../stores/settings'

const settingsStore = useSettingsStore()

const events = ref([])
const pendingCount = ref(0)
const loading = ref(true)
const triggering = ref(false)
const copied = ref(false)

const webhookUrl = computed(() => {
  return `${window.location.origin}/api/webhook`
})

const digestInterval = computed(() => settingsStore.digest?.interval_minutes || 15)
const activeRecipients = computed(() =>
  settingsStore.recipients.filter(r => r.active).length
)

onMounted(async () => {
  await Promise.all([
    loadEvents(),
    loadPending(),
    settingsStore.loadDigest(),
    settingsStore.loadRecipients()
  ])
})

async function loadEvents() {
  loading.value = true
  try {
    const response = await api.get('/events?limit=50')
    events.value = response.data
  } finally {
    loading.value = false
  }
}

async function loadPending() {
  const response = await api.get('/events/pending')
  pendingCount.value = response.data.count
}

async function triggerDigest() {
  triggering.value = true
  try {
    await settingsStore.triggerDigest()
    await Promise.all([loadEvents(), loadPending()])
  } catch (e) {
    alert('Failed to send digest: ' + e.message)
  } finally {
    triggering.value = false
  }
}

function copyUrl() {
  navigator.clipboard.writeText(webhookUrl.value)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}

function formatEventType(type) {
  const map = {
    cardCreate: 'Card Created',
    cardUpdate: 'Card Updated',
    cardDelete: 'Card Deleted',
    commentCreate: 'Comment Added',
    cardMembershipCreate: 'Member Added',
    cardMembershipDelete: 'Member Removed',
    attachmentCreate: 'Attachment Added',
    listCreate: 'List Created',
    listUpdate: 'List Updated',
    listDelete: 'List Deleted'
  }
  return map[type] || type
}

function formatEventDetails(event) {
  const payload = event.payload
  if (payload.item?.name) {
    return payload.item.name
  }
  if (payload.item?.text) {
    return payload.item.text.substring(0, 100)
  }
  return ''
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('de-DE')
}
</script>
