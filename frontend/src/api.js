const BASE_URL = '/api'

class Api {
  async request(method, path, data = null) {
    const token = localStorage.getItem('token')

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`
    }

    if (data) {
      options.body = JSON.stringify(data)
    }

    const response = await fetch(`${BASE_URL}${path}`, options)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || 'Request failed')
    }

    return { data: await response.json() }
  }

  get(path) {
    return this.request('GET', path)
  }

  post(path, data) {
    return this.request('POST', path, data)
  }

  put(path, data) {
    return this.request('PUT', path, data)
  }

  delete(path) {
    return this.request('DELETE', path)
  }
}

export const api = new Api()
