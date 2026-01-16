import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || null)

  const isAuthenticated = computed(() => !!token.value)

  async function login(password) {
    const response = await api.post('/auth/login', { password })
    token.value = response.data.token
    localStorage.setItem('token', response.data.token)
    return response.data
  }

  function logout() {
    token.value = null
    localStorage.removeItem('token')
  }

  async function checkAuth() {
    if (!token.value) return false

    try {
      await api.get('/auth/check')
      return true
    } catch {
      logout()
      return false
    }
  }

  async function changePassword(currentPassword, newPassword) {
    return api.post('/auth/change-password', { currentPassword, newPassword })
  }

  return {
    token,
    isAuthenticated,
    login,
    logout,
    checkAuth,
    changePassword
  }
})
