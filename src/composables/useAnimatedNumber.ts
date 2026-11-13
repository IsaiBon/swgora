import { ref, watch, onUnmounted, type Ref } from 'vue'

/**
 * Anima suavemente cualquier valor numérico (entero o decimal) usando ease-out cúbico.
 * Respeta automáticamente `prefers-reduced-motion: reduce`.
 */
export function useAnimatedNumber(source: () => number, durationMs = 460): Ref<number> {
  const initial = Number.isFinite(source()) ? source() : 0
  const displayed = ref<number>(initial)
  let rafId: number | null = null

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const animateTo = (target: number) => {
    const safeTarget = Number.isFinite(target) ? target : 0

    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

    if (prefersReducedMotion() || typeof performance === 'undefined') {
      displayed.value = safeTarget
      return
    }

    const from = displayed.value
    const delta = safeTarget - from
    if (Math.abs(delta) < 0.001) {
      displayed.value = safeTarget
      return
    }

    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / durationMs, 1)
      // Cubic ease-out: rápido al iniciar, aterrizaje preciso y suave
      const eased = 1 - Math.pow(1 - progress, 3)
      displayed.value = from + delta * eased

      if (progress < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        displayed.value = safeTarget
        rafId = null
      }
    }

    rafId = requestAnimationFrame(step)
  }

  watch(source, (newVal) => {
    animateTo(newVal)
  })

  onUnmounted(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }
  })

  return displayed
}
