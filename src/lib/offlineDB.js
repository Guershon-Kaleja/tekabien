const DB_NAME = 'tekabien_offline'
const DB_VERSION = 2
const SALES_STORE = 'pending_sales'

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (db.objectStoreNames.contains(SALES_STORE)) {
        db.deleteObjectStore(SALES_STORE)
      }
      const store = db.createObjectStore(SALES_STORE, { keyPath: 'local_id' })
      store.createIndex('synced', 'synced', { unique: false })
      store.createIndex('user_id', 'user_id', { unique: false })
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

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

export const isOnline = () => navigator.onLine