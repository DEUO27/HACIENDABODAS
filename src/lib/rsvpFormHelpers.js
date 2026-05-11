export function parseCompanionCount(value) {
  const parsed = Number.parseInt(String(value || 0), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function clampCompanionCounts(nextAdult, nextChild, max) {
  const safeAdult = parseCompanionCount(nextAdult)
  const safeChild = parseCompanionCount(nextChild)
  const total = safeAdult + safeChild

  if (total <= max) {
    return { adultPlusOnes: safeAdult, childPlusOnes: safeChild, plusOnes: total }
  }

  const availableForChildren = Math.max(0, max - safeAdult)
  const clampedChild = Math.min(safeChild, availableForChildren)
  const clampedAdult = Math.min(safeAdult, max - clampedChild)

  return {
    adultPlusOnes: clampedAdult,
    childPlusOnes: clampedChild,
    plusOnes: clampedAdult + clampedChild,
  }
}
