export function isIos() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua) && !window.MSStream
}

export function isMobileDevice() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/.test(ua) && !window.MSStream) return true
  if (/Android/i.test(ua)) return true
  return /Mobi/i.test(ua)
}
