import { localDb } from './localDb'
import { supabase } from './supabase'

// ─── Pull ─────────────────────────────────────────────────────────────────────
// Récupère toutes les données Supabase et les écrit dans IndexedDB
export async function pull(userId) {
  if (!userId) return

  const [products, sales, expenses, customers, debts, payments] = await Promise.all([
    supabase.from('products').select('*').eq('user_id', userId),
    supabase.from('sales').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(500),
    supabase.from('expenses').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(500),
    supabase.from('customers').select('*').eq('user_id', userId),
    supabase.from('debts').select('*').eq('user_id', userId),
    supabase.from('debt_payments').select('*').eq('user_id', userId).limit(1000),
  ])

  await localDb.transaction('rw',
    [localDb.products, localDb.sales, localDb.expenses,
     localDb.customers, localDb.debts, localDb.debt_payments, localDb.sync_meta],
    async () => {
      if (products.data?.length)      await localDb.products.bulkPut(products.data)
      if (sales.data?.length)         await localDb.sales.bulkPut(sales.data)
      if (expenses.data?.length)      await localDb.expenses.bulkPut(expenses.data)
      if (customers.data?.length)     await localDb.customers.bulkPut(customers.data)
      if (debts.data?.length)         await localDb.debts.bulkPut(debts.data)
      if (payments.data?.length)      await localDb.debt_payments.bulkPut(payments.data)
      await localDb.sync_meta.put({ key: 'last_pull', value: new Date().toISOString(), userId })
    }
  )
}

// ─── Queue ────────────────────────────────────────────────────────────────────
export async function addToQueue(type, data) {
  await localDb.sync_queue.add({ type, data, status: 'pending', created_at: Date.now() })
}

export async function getPendingCount() {
  return localDb.sync_queue.where('status').equals('pending').count()
}

// ─── Push ─────────────────────────────────────────────────────────────────────
// Envoie toutes les opérations en attente vers Supabase
export async function push() {
  const pending = await localDb.sync_queue
    .where('status').equals('pending')
    .sortBy('seq')

  for (const op of pending) {
    await localDb.sync_queue.update(op.seq, { status: 'syncing' })
    try {
      await processOp(op)
      await localDb.sync_queue.delete(op.seq)
    } catch {
      await localDb.sync_queue.update(op.seq, { status: 'pending' })
    }
  }
}

async function processOp(op) {
  switch (op.type) {

    // ── Produits ──────────────────────────────────────────────────────────────
    case 'product_insert':
      await supabase.from('products').upsert(op.data)
      break

    case 'product_update': {
      const { id, ...fields } = op.data
      await supabase.from('products').update(fields).eq('id', id)
      break
    }

    case 'product_delete':
      await supabase.from('products').delete().eq('id', op.data.id)
      break

    // ── Ventes (opération composée : vente + delta stock + dette éventuelle) ──
    case 'sale_create': {
      const { sale, productId, quantityDelta, debt, customerId, customerDebtDelta } = op.data

      const { error: saleErr } = await supabase.from('sales').upsert(sale)
      if (saleErr) throw saleErr

      // delta stock : on récupère la valeur serveur pour appliquer le delta
      if (productId && quantityDelta) {
        const { data: prod } = await supabase
          .from('products').select('quantity').eq('id', productId).single()
        if (prod) {
          const newQty = Math.max(0, prod.quantity + quantityDelta)
          await supabase.from('products').update({ quantity: newQty }).eq('id', productId)
          await localDb.products.where('id').equals(productId).modify(p => { p.quantity = newQty })
        }
      }

      if (debt) await supabase.from('debts').upsert(debt)

      if (customerId && customerDebtDelta) {
        const { data: cust } = await supabase
          .from('customers').select('total_debt').eq('id', customerId).single()
        if (cust) {
          await supabase.from('customers')
            .update({ total_debt: cust.total_debt + customerDebtDelta })
            .eq('id', customerId)
        }
      }
      break
    }

    // ── Annulation vente (opération composée inverse) ─────────────────────────
    case 'sale_cancel': {
      const { saleId, productId, quantityDelta, customerId, saleTotal } = op.data

      const { error: delErr } = await supabase.from('sales').delete().eq('id', saleId)
      if (delErr) throw delErr

      if (productId && quantityDelta) {
        const { data: prod } = await supabase
          .from('products').select('quantity').eq('id', productId).single()
        if (prod) {
          const newQty = prod.quantity + quantityDelta
          await supabase.from('products').update({ quantity: newQty }).eq('id', productId)
          await localDb.products.where('id').equals(productId).modify(p => { p.quantity = newQty })
        }
      }

      if (customerId && saleTotal) {
        const { data: cust } = await supabase
          .from('customers').select('total_debt').eq('id', customerId).single()
        if (cust) {
          await supabase.from('customers')
            .update({ total_debt: Math.max(0, cust.total_debt - saleTotal) })
            .eq('id', customerId)
        }
      }
      break
    }

    // ── Dépenses ──────────────────────────────────────────────────────────────
    case 'expense_insert':
      await supabase.from('expenses').upsert(op.data)
      break

    case 'expense_update': {
      const { id, ...fields } = op.data
      await supabase.from('expenses').update(fields).eq('id', id)
      break
    }

    case 'expense_delete':
      await supabase.from('expenses').delete().eq('id', op.data.id)
      break

    // ── Clients ───────────────────────────────────────────────────────────────
    case 'customer_insert':
      await supabase.from('customers').upsert(op.data)
      break

    case 'customer_update': {
      const { id, ...fields } = op.data
      await supabase.from('customers').update(fields).eq('id', id)
      break
    }

    case 'customer_delete': {
      const { id } = op.data
      await supabase.from('sales').update({ customer_id: null, customer_name: null }).eq('customer_id', id)
      await supabase.from('debt_payments').delete().eq('customer_id', id)
      await supabase.from('debts').delete().eq('customer_id', id)
      await supabase.from('customers').delete().eq('id', id)
      break
    }

    // ── Remboursements ────────────────────────────────────────────────────────
    case 'payment_insert': {
      const { payment, customerId, newDebt, newPaid } = op.data
      await supabase.from('debt_payments').upsert(payment)
      await supabase.from('customers').update({ total_debt: newDebt, total_paid: newPaid }).eq('id', customerId)
      if (newDebt === 0) {
        await supabase.from('sales').update({ encaissee: true })
          .eq('customer_id', customerId).eq('payment_method', 'credit').eq('encaissee', false)
        await supabase.from('debts').update({ status: 'paid', paid: op.data.payment.amount })
          .eq('customer_id', customerId).eq('status', 'pending')
      }
      break
    }

    // ── Dette manuelle ────────────────────────────────────────────────────────
    case 'debt_insert': {
      const { debt, customerId, newDebt } = op.data
      await supabase.from('debts').upsert(debt)
      await supabase.from('customers').update({ total_debt: newDebt }).eq('id', customerId)
      break
    }

    default:
      break
  }
}

// ─── Sync complet ─────────────────────────────────────────────────────────────
export async function sync(userId) {
  await push()
  await pull(userId)
}

// ─── Utilitaire ───────────────────────────────────────────────────────────────
export function hasLocalData(userId) {
  return localDb.products.where('user_id').equals(userId).count()
}
