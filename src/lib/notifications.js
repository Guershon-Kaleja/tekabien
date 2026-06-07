import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

const isNative = Capacitor.isNativePlatform()

// ─── Permission ───────────────────────────────────────────────────────────────
export async function requestNotificationPermission() {
  if (isNative) {
    const { display } = await LocalNotifications.requestPermissions()
    return display === 'granted'
  }
  if ('Notification' in window) {
    const result = await Notification.requestPermission()
    return result === 'granted'
  }
  return false
}

// ─── Envoi générique ──────────────────────────────────────────────────────────
async function send({ id, title, body, scheduleAt }) {
  if (isNative) {
    await LocalNotifications.schedule({
      notifications: [{
        id: id ?? Math.floor(Math.random() * 100000),
        title,
        body,
        schedule: scheduleAt ? { at: scheduleAt } : undefined,
        sound: undefined,
        smallIcon: 'ic_launcher_foreground',
      }]
    })
  } else if ('Notification' in window && Notification.permission === 'granted') {
    if (scheduleAt) {
      const delay = scheduleAt.getTime() - Date.now()
      if (delay > 0) setTimeout(() => new Notification(title, { body }), delay)
    } else {
      new Notification(title, { body })
    }
  }
}

// ─── Stock bas ────────────────────────────────────────────────────────────────
export async function notifyLowStock(productName, quantity) {
  await send({
    id: Math.floor(Math.random() * 10000),
    title: '⚠️ Stock bas',
    body: `${productName} — il ne reste que ${quantity} unité${quantity > 1 ? 's' : ''}`,
  })
}

// ─── Rappel dette (veille de l'échéance) ─────────────────────────────────────
export async function scheduleDebtReminder(clientName, amount, dueDateStr, currency = 'FC') {
  if (!dueDateStr) return

  const dueDate = new Date(dueDateStr)
  const reminderDate = new Date(dueDate)
  reminderDate.setDate(reminderDate.getDate() - 1)
  reminderDate.setHours(9, 0, 0, 0)

  if (reminderDate <= new Date()) return

  const formatted = new Intl.NumberFormat('fr-FR').format(amount)

  await send({
    id: Math.abs(clientName.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 100000,
    title: '💰 Rappel paiement demain',
    body: `${clientName} doit rembourser ${formatted} ${currency} demain`,
    scheduleAt: reminderDate,
  })
}

// ─── Dettes en retard (au démarrage) ─────────────────────────────────────────
export async function notifyOverdueDebts(overdueClients) {
  if (!overdueClients.length) return

  const names = overdueClients.slice(0, 3).map(c => c.name).join(', ')
  const more = overdueClients.length > 3 ? ` et ${overdueClients.length - 3} autre(s)` : ''

  await send({
    id: 99001,
    title: '🔴 Dettes en retard',
    body: `${names}${more} ont dépassé leur date de remboursement`,
  })
}

// ─── Résumé quotidien à 20h ───────────────────────────────────────────────────
export async function scheduleDailySummary(salesCount, totalAmount, currency = 'FC') {
  const at = new Date()
  at.setHours(20, 0, 0, 0)
  if (at <= new Date()) return // déjà passé aujourd'hui

  const formatted = new Intl.NumberFormat('fr-FR').format(totalAmount)

  await send({
    id: 99002,
    title: '📊 Résumé du jour',
    body: salesCount > 0
      ? `${salesCount} vente${salesCount > 1 ? 's' : ''} aujourd'hui — ${formatted} ${currency} encaissés`
      : "Aucune vente aujourd'hui — nouvelle journée demain !",
    scheduleAt: at,
  })
}

// ─── Annuler un rappel ────────────────────────────────────────────────────────
export async function cancelNotification(id) {
  if (isNative) {
    await LocalNotifications.cancel({ notifications: [{ id }] })
  }
}
