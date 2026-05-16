const DB_NAME = 'tekabien_offline'
const DB_VERSION = 3
const SALES_STORE = 'pending_sales'
const EXPENSES_STORE = 'pending_expenses'
const CACHE_STORE = 'cache_data'

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // Store ventes offline
      if (!db.objectStoreNames.contains(SALES_STORE)) {
        const store = db.createObjectStore(SALES_STORE, { keyPath: 'local_id' })
        store.createIndex('synced', 'synced', { unique: false })
        store.createIndex('user_id', 'user_id', { unique: false })
      }

      // Store dépenses offline
      if (!db.objectStoreNames.contains(EXPENSES_STORE)) {
        const store = db.createObjectStore(EXPENSES_STORE, { keyPath: 'local_id' })
        store.createIndex('synced', 'synced', { unique: false })
        store.createIndex('user_id', 'user_id', { unique: false })
      }

      // Store cache (stocks, clients)
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' })
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

export const getCleanPendingSales = async (userId) => {
  const pending = await getPendingSales(userId)
  return pending.map(({ local_id, ...saleData }) => {
    delete saleData.synced
    return { local_id, saleData }
  })
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
    request.onsuccess = () => resolve(request.result?.data || null)
    request.onerror = () => reject(request.error)
  })
}

// ==================== UTILITAIRES ====================

export const isOnline = () => navigator.onLine