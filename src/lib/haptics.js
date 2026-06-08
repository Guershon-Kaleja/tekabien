import { Capacitor } from '@capacitor/core'

let _H = null
async function get() {
  if (!Capacitor.isNativePlatform()) return null
  if (!_H) {
    try { _H = (await import('@capacitor/haptics')).Haptics }
    catch { _H = null }
  }
  return _H
}

export async function hapticLight() {
  const H = await get()
  if (H) H.impact({ style: 'LIGHT' }).catch(() => {})
}

export async function hapticMedium() {
  const H = await get()
  if (H) H.impact({ style: 'MEDIUM' }).catch(() => {})
}

export async function hapticSuccess() {
  const H = await get()
  if (H) H.notification({ type: 'SUCCESS' }).catch(() => {})
}

export async function hapticError() {
  const H = await get()
  if (H) H.notification({ type: 'ERROR' }).catch(() => {})
}
