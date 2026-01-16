<template>
  <div class="min-h-screen bg-gray-100 dark:bg-black transition-colors">
    <nav v-if="authStore.isAuthenticated" class="bg-indigo-600 dark:bg-neutral-900 dark:border-b dark:border-neutral-800 text-white shadow-lg">
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex justify-between h-16 items-center">
          <div class="flex items-center space-x-8">
            <span class="text-xl font-bold">Planka Webhooks</span>
            <div class="flex space-x-4">
              <router-link to="/" class="hover:bg-indigo-700 dark:hover:bg-neutral-800 px-3 py-2 rounded-lg transition-colors">
                Dashboard
              </router-link>
              <router-link to="/settings" class="hover:bg-indigo-700 dark:hover:bg-neutral-800 px-3 py-2 rounded-lg transition-colors">
                Settings
              </router-link>
              <router-link to="/filters" class="hover:bg-indigo-700 dark:hover:bg-neutral-800 px-3 py-2 rounded-lg transition-colors">
                Event Filters
              </router-link>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <button @click="themeStore.toggle()" class="hover:bg-indigo-700 dark:hover:bg-neutral-800 p-2 rounded-lg transition-colors" title="Toggle dark mode">
              <svg v-if="themeStore.isDark" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
              </svg>
              <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
              </svg>
            </button>
            <button @click="logout" class="hover:bg-indigo-700 dark:hover:bg-neutral-800 px-3 py-2 rounded-lg transition-colors">
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>

    <main class="max-w-7xl mx-auto px-4 py-8">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const router = useRouter()

function logout() {
  authStore.logout()
  router.push('/login')
}
</script>
