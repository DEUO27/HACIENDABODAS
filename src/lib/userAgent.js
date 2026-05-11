export function isIos() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua) && !window.MSStream
}
