const DB_NAME = 'tekabien_offline'
const DB_VERSION = 4
const SALES_STORE = 'pending_sales'
const EXPENSES_STORE = 'pending_expenses'
const CACHE_STORE = 'cache_data'
const FAILED_STORE = 'failed_syncs'

const CACHE_MAX_AGE_HOURS = 24

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      if (!db.objectStoreNames.contains(SALES_STORE)) {
        const store = db.createObjectStore(SALES_STORE, { keyPath: 'local_id' })
        store.createIndex('synced', 'synced', { unique: false })
        store.createIndex('user_id', 'user_id', { unique: false })
      }

      if (!db.objectStoreNames.contains(EXPENSES_STORE)) {
        const store = db.createObjectStore(EXPENSES_STORE, { keyPath: 'local_id' })
        store.createIndex('synced', 'synced', { unique: false })
        store.createIndex('user_id', 'user_id', { unique: false })
      }

      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' })
      }

      // Nouveau store pour les syncs échouées
      if (!db.objectStoreNames.contains(FAILED_STORE)) {
        const store = db.createObjectStore(FAILED_STORE, { keyPath: 'local_id' })
        store.createIndex('user_id', 'user_id', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ==================== VENTES ====================

export const saveSaleOffline = async (sale) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SALES_STORE, 'readwrite')
    const store = tx.objectStore(SALES_STORE)
    const saleWithId = {
      ...sale,
      local_id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      synced: 0,
      sync_attempts: 0,
      created_at: new Date().toISOString(),
    }
    const request = store.add(saleWithId)
    request.onsuccess = () => resolve(saleWithId)
    request.onerror = () => reject(request.error)
  })
}

export const getPendingSales = async (userId) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SALES_STORE, 'readonly')
    const store = tx.objectStore(SALES_STORE)
    const index = store.index('synced')
    const request = index.getAll(0)
    request.onsuccess = () => {
      const all = request.result
      const filtered = userId ? all.filter(s => s.user_id === userId) : all
      resolve(filtered)
    }
    request.onerror = () => reject(request.error)
  })
}

// Retourne les ventes offline pour affichage dans l'historique
export const getPendingSalesForDisplay = async (userId) => {
  const pending = await getPendingSales(userId)
  return pending.map(sale => ({
    ...sale,
    id: sale.local_id,
    isOffline: true,
  }))
}

export const getCleanPendingSales = async (userId) => {
  const pending = await getPendingSales(userId)
  return pending.map(({ local_id, synced, sync_attempts, ...saleData }) => ({
    local_id,
    saleData,
  }))
}

export const markSaleSynced = async (localId) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SALES_STORE, 'readwrite')
    const store = tx.objectStore(SALES_STORE)
    const getRequest = store.get(localId)
    getRequest.onsuccess = () => {
      const sale = getRequest.result
      if (sale) {
        sale.synced = 1
        sale.synced_at = new Date().toISOString()
        const putRequest = store.put(sale)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      } else {
        resolve()
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })
}

export const markSaleFailed = async (localId, reason) => {
  const db = await openDB()
  return new Promise(async (resolve, reject) => {
    try {
      // Incrémenter le compteur de tentatives
      const tx1 = db.transaction(SALES_STORE, 'readwrite')
      const store1 = tx1.objectStore(SALES_STORE)
      const getRequest = store1.get(localId)

      getRequest.onsuccess = async () => {
        const sale = getRequest.result
        if (sale) {
          sale.sync_attempts = (sale.sync_attempts || 0) + 1
          sale.last_error = reason
          store1.put(sale)
        }
      }

      // Enregistrer dans failed_syncs pour notification
      const tx2 = db.transaction(FAILED_STORE, 'readwrite')
      const store2 = tx2.objectStore(FAILED_STORE)
      store2.put({
        local_id: localId,
        reason,
        failed_at: new Date().toISOString(),
        user_id: db._userId,
      })

      resolve()
    } catch (err) {
      reject(err)
    }
  })
}

// Nettoyer les ventes synced de plus de 7 jours
export const cleanOldSyncedSales = async () => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SALES_STORE, 'readwrite')
    const store = tx.objectStore(SALES_STORE)
    const index = store.index('synced')
    const request = index.getAll(1)
    request.onsuccess = () => {
      const synced = request.result
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      let deleted = 0
      synced.forEach(sale => {
        if (sale.synced_at && sale.synced_at < sevenDaysAgo) {
          store.delete(sale.local_id)
          deleted++
        }
      })
      resolve(deleted)
    }
    request.onerror = () => reject(request.error)
  })
}

export const getFailedSales = async (userId) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FAILED_STORE, 'readonly')
    const store = tx.objectStore(FAILED_STORE)
    const request = store.getAll()
    request.onsuccess = () => {
      const all = request.result
      const filtered = userId ? all.filter(s => s.user_id === userId) : all
      resolve(filtered)
    }
    request.onerror = () => reject(request.error)
  })
}

export const clearFailedSales = async () => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FAILED_STORE, 'readwrite')
    const store = tx.objectStore(FAILED_STORE)
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ==================== DÉPENSES ====================

export const saveExpenseOffline = async (expense) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EXPENSES_STORE, 'readwrite')
    const store = tx.objectStore(EXPENSES_STORE)
    const expenseWithId = {
      ...expense,
      local_id: `local_exp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      synced: 0,
      sync_attempts: 0,
      created_at: new Date().toISOString(),
    }
    const request = store.add(expenseWithId)
    request.onsuccess = () => resolve(expenseWithId)
    request.onerror = () => reject(request.error)
  })
}

export const getPendingExpenses = async (userId) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EXPENSES_STORE, 'readonly')
    const store = tx.objectStore(EXPENSES_STORE)
    const index = store.index('synced')
    const request = index.getAll(0)
    request.onsuccess = () => {
      const all = request.result
      const filtered = userId ? all.filter(e => e.user_id === userId) : all
      resolve(filtered)
    }
    request.onerror = () => reject(request.error)
  })
}

export const markExpenseSynced = async (localId) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EXPENSES_STORE, 'readwrite')
    const store = tx.objectStore(EXPENSES_STORE)
    const getRequest = store.get(localId)
    getRequest.onsuccess = () => {
      const expense = getRequest.result
      if (expense) {
        expense.synced = 1
        expense.synced_at = new Date().toISOString()
        const putRequest = store.put(expense)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      } else {
        resolve()
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })
}

// Nettoyer les dépenses synced de plus de 7 jours
export const cleanOldSyncedExpenses = async () => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EXPENSES_STORE, 'readwrite')
    const store = tx.objectStore(EXPENSES_STORE)
    const index = store.index('synced')
    const request = index.getAll(1)
    request.onsuccess = () => {
      const synced = request.result
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      synced.forEach(expense => {
        if (expense.synced_at && expense.synced_at < sevenDaysAgo) {
          store.delete(expense.local_id)
        }
      })
      resolve()
    }
    request.onerror = () => reject(request.error)
  })
}

// ==================== CACHE ====================

export const setCache = async (key, data) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readwrite')
    const store = tx.objectStore(CACHE_STORE)
    const request = store.put({
      key,
      data,
      cached_at: new Date().toISOString(),
    })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export const getCache = async (key) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readonly')
    const store = tx.objectStore(CACHE_STORE)
    const request = store.get(key)
    request.onsuccess = () => {
      const result = request.result
      if (!result) { resolve(null); return }

      // Vérifier l'expiration du cache
      const cachedAt = new Date(result.cached_at)
      const now = new Date()
      const ageHours = (now - cachedAt) / (1000 * 60 * 60)

      if (ageHours > CACHE_MAX_AGE_HOURS) {
        // Cache expiré
        resolve({ data: result.data, expired: true, ageHours: Math.round(ageHours) })
      } else {
        resolve({ data: result.data, expired: false, ageHours: Math.round(ageHours) })
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export const getCacheAge = async (key) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readonly')
    const store = tx.objectStore(CACHE_STORE)
    const request = store.get(key)
    request.onsuccess = () => {
      const result = request.result
      if (!result) { resolve(null); return }
      const cachedAt = new Date(result.cached_at)
      const now = new Date()
      const ageMinutes = Math.round((now - cachedAt) / (1000 * 60))
      resolve(ageMinutes)
    }
    request.onerror = () => reject(request.error)
  })
}

export const deleteCache = async (key) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readwrite')
    const store = tx.objectStore(CACHE_STORE)
    const request = store.delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ==================== NETTOYAGE GLOBAL ====================

export const cleanupOfflineDB = async () => {
  await cleanOldSyncedSales()
  await cleanOldSyncedExpenses()
}

// ==================== UTILITAIRES ====================

export const isOnline = () => navigator.onLine

export const formatCacheAge = (minutes) => {
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.round(hours / 24)
  return `il y a ${days} jour${days > 1 ? 's' : ''}`
}