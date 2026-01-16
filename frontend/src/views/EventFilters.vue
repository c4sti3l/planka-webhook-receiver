<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-800 dark:text-white">Event Filters</h1>
      <p class="text-gray-600 dark:text-neutral-500">Choose which Planka events should trigger email notifications.</p>
    </div>

    <div class="card">
      <div v-if="loading" class="text-gray-500 dark:text-neutral-500">Loading...</div>

      <div v-else class="space-y-1">
        <div
          v-for="filter in filters"
          :key="filter.event_type"
          class="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
        >
          <div class="flex items-center space-x-3">
            <input
              type="checkbox"
              :id="filter.event_type"
              :checked="filter.enabled"
              @change="toggleFilter(filter)"
              class="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
            />
            <label :for="filter.event_type" class="cursor-pointer">
              <div class="font-medium text-gray-800 dark:text-white">{{ filter.description }}</div>
              <div class="text-sm text-gray-500 dark:text-neutral-500">{{ filter.event_type }}</div>
            </label>
          </div>
          <span
            class="px-2 py-1 text-xs rounded-full"
            :class="filter.enabled
              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-500'"
          >
            {{ filter.enabled ? 'Enabled' : 'Disabled' }}
          </span>
        </div>
      </div>
    </div>

    <div class="card bg-blue-50 dark:bg-neutral-900 border border-blue-200 dark:border-neutral-800">
      <h3 class="font-semibold text-blue-800 dark:text-neutral-300">How it works</h3>
      <ul class="text-sm text-blue-700 dark:text-neutral-400 mt-2 space-y-1">
        <li>1. Planka sends webhooks for various events</li>
        <li>2. Only enabled events are queued for the digest</li>
        <li>3. A digest email is sent at the configured interval</li>
        <li>4. All queued events are included in the email</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '../stores/settings'

const settingsStore = useSettingsStore()
const loading = ref(true)

const filters = computed(() => settingsStore.filters)

onMounted(async () => {
  await settingsStore.loadFilters()
  loading.value = false
})

async function toggleFilter(filter) {
  await settingsStore.updateFilter(filter.event_type, !filter.enabled)
}
</script>
