import Dexie from 'dexie'

export const localDb = new Dexie('tekabien_v1')

localDb.version(1).stores({
  products:      'id, user_id',
  sales:         'id, user_id, created_at',
  expenses:      'id, user_id, created_at',
  customers:     'id, user_id',
  debts:         'id, user_id, customer_id',
  debt_payments: 'id, user_id, customer_id',
  sync_queue:    '++seq, type, status, created_at',
  sync_meta:     'key',
})
