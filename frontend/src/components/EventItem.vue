<template>
  <div
      class="border-l-4 pl-3 py-2 rounded-r pr-2"
      :class="event.processed
      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
      : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'"
  >
    <!-- Header -->
    <div class="flex justify-between">
      <span class="font-medium text-gray-800 dark:text-white">
        {{ eventType }}
      </span>

      <span
          class="text-xs"
          :class="event.processed
          ? 'text-green-600 dark:text-green-400'
          : 'text-yellow-600 dark:text-yellow-400'"
      >

        {{ event.processed ? 'Sent' : 'Pending' }} - {{ formatDate(event.received_at) }}
      </span>
    </div>

    <!-- ✅ SLIM META DATA -->
    <div class="mt-2 space-y-1 text-sm">
      <div v-if="details.item" class="flex gap-2 leading-5">
        <div class="w-24 text-xs text-gray-500 dark:text-neutral-400">
          Card
        </div>
        <div class="flex-1 font-medium text-gray-800 dark:text-neutral-200">
          {{ details.item }}
        </div>
      </div>

      <div v-if="details.board" class="flex gap-2 leading-5">
        <div class="w-24 text-xs text-gray-500 dark:text-neutral-400">
          Board
        </div>
        <div class="flex-1 font-medium text-gray-800 dark:text-neutral-200">
          {{ details.board }}
        </div>
      </div>

      <div v-if="details.list" class="flex gap-2 leading-5">
        <div class="w-24 text-xs text-gray-500 dark:text-neutral-400">
          List
        </div>
        <div class="flex-1 font-medium text-gray-800 dark:text-neutral-200">
          {{ details.list }}
        </div>
      </div>

      <div v-if="details.project" class="flex gap-2 leading-5">
        <div class="w-24 text-xs text-gray-500 dark:text-neutral-400">
          Project
        </div>
        <div class="flex-1 font-medium text-gray-800 dark:text-neutral-200">
          {{ details.project }}
        </div>
      </div>

      <div v-if="details.user" class="flex gap-2 leading-5">
        <div class="w-24 text-xs text-gray-500 dark:text-neutral-400">
          User
        </div>
        <div class="flex-1 font-medium text-gray-800 dark:text-neutral-200">
          {{ details.user }}
        </div>
      </div>
    </div>

    <!-- ✅ DIFF TABLE -->
    <div
        v-if="changes.length"
        class="mt-3 rounded-lg border border-indigo-200 dark:border-gray-700 overflow-hidden"
    >
      <table class="w-full text-sm">
        <tbody class="divide-y divide-gray-200 dark:divide-neutral-700">

        <tr v-for="c in changes" :key="c.field">

          <!-- Field -->
          <td class="px-3 py-2 text-xs font-medium text-gray-500 dark:text-neutral-400 w-28 align-top">
            {{ c.label }}
          </td>

          <!-- Before -->
          <td
              class="px-3 py-2 text-gray-500 dark:text-neutral-500 whitespace-pre-wrap"
              :class="c.type === 'move' ? 'italic' : ''"
          >
            {{ c.before ?? '—' }}
          </td>

          <!-- After -->
          <td
              class="px-3 py-2 font-semibold whitespace-pre-wrap text-neutral-200"
          >
            {{ c.after ?? '—' }}
          </td>

        </tr>

        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import {computed} from 'vue'

const props = defineProps({
  event: {type: Object, required: true}
})

/* mappings */
const eventTypeMap = {
  cardCreate: 'Card Created',
  cardUpdate: 'Card Updated',
  cardDelete: 'Card Deleted'
}

const actionTextMap = {
  cardCreate: 'created card',
  cardUpdate: 'updated card',
  cardDelete: 'deleted card'
}

const eventType = computed(
    () => eventTypeMap[props.event.event_type] || props.event.event_type
)

const actionText = computed(
    () => actionTextMap[props.event.event_type] || props.event.event_type
)

/* meta details */
const details = computed(() => {
  const data = props.event.payload?.data
  const user = props.event.payload?.user
  if (!data) {
    return {}
  }

  const {item, included = {}} = data
  const board = included.boards?.find(b => b.id === item?.boardId)
  const list = included.lists?.find(l => l.id === item?.listId)
  const project = included.projects?.find(p => p.id === board?.projectId)

  return {
    item: item?.name,
    board: board?.name,
    list: list?.name,
    project: project?.name,
    user: user?.name
  }
})

const changes = computed(() => {
  if (props.event.event_type !== 'cardUpdate') {
    return []
  }

  const dataItem = props.event.payload?.data?.item
  const prevItem = props.event.payload?.prevData?.item
  const included = props.event.payload?.data?.included || {}

  if (!dataItem || !prevItem) {
    return []
  }

  const resolveList = id =>
      included.lists?.find(l => l.id === id)?.name || id

  const resolveBoard = id =>
      included.boards?.find(b => b.id === id)?.name || id

  const fields = [
    {
      key: 'name',
      label: 'Title',
      type: 'text'
    },
    {
      key: 'description',
      label: 'Description',
      type: 'multiline'
    },
    {
      key: 'listId',
      label: 'List',
      type: 'move',
      map: resolveList
    },
    {
      key: 'boardId',
      label: 'Board',
      type: 'move',
      map: resolveBoard
    }
  ]

  return fields
      .map(f => {
        const beforeRaw = prevItem[f.key]
        const afterRaw = dataItem[f.key]

        if (beforeRaw === afterRaw) {
          return null
        }

        return {
          field: f.key,
          label: f.label,
          type: f.type,
          before: f.map ? f.map(beforeRaw) : beforeRaw,
          after: f.map ? f.map(afterRaw) : afterRaw
        }
      })
      .filter(Boolean)
})


function formatDate(value) {
  return new Date(value).toLocaleString('de-DE')
}

function afterClass(type) {
  switch (type) {
    case 'move':
      return 'text-blue-600 dark:text-blue-400'
    case 'multiline':
      return 'text-indigo-600 dark:text-indigo-400'
    default:
      return 'text-green-600 dark:text-green-100'
  }
}

</script>
