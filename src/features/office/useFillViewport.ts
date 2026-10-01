"use client"

import { useLayoutEffect, type RefObject } from "react"

const BOTTOM_GAP_PX = 16
const MIN_HEIGHT_PX = 420

/** Height of any fixed/sticky bar covering the bottom of the viewport (e.g. a mobile menu trigger). */
const bottomObstruction = (root: HTMLElement): number => {
  const y = window.innerHeight - 2
  let covered = 0
  for (const x of [8, window.innerWidth / 2, window.innerWidth - 8]) {
    for (const element of document.elementsFromPoint(x, y)) {
      if (root.contains(element)) continue
      let node: HTMLElement | null = element instanceof HTMLElement ? element : null
      while (node && node !== document.body) {
        const position = getComputedStyle(node).position
        if (position === "fixed" || position === "sticky") {
          const rect = node.getBoundingClientRect()
          if (rect.top > window.innerHeight / 2 && rect.width > 120) covered = Math.max(covered, window.innerHeight - rect.top)
          break
        }
        node = node.parentElement
      }
    }
  }
  return covered
}

/** Nearest ancestor that scrolls vertically, or null when the document itself scrolls. */
const scrollParent = (node: HTMLElement): HTMLElement | null => {
  let current = node.parentElement
  while (current && current !== document.body && current !== document.documentElement) {
    const overflowY = getComputedStyle(current).overflowY
    if (overflowY === "auto" || overflowY === "scroll") return current
    current = current.parentElement
  }
  return null
}

/**
 * Size a box so it fills the viewport below whatever chrome sits above it and above any bar pinned
 * to the bottom, writing the result to the `--office-h` custom property. The chat therefore fits one
 * screen and its composer is always visible, however tall the shell's header or banners are.
 */
export const useFillViewport = (ref: RefObject<HTMLElement | null>) => {
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    let frame = 0
    const measure = () => {
      const scroller = scrollParent(node)
      const obstruction = bottomObstruction(node)
      const rect = node.getBoundingClientRect()
      let available: number
      if (scroller) {
        const box = scroller.getBoundingClientRect()
        const offset = rect.top - box.top + scroller.scrollTop
        available = Math.min(scroller.clientHeight, window.innerHeight - obstruction - box.top) - offset
      } else {
        available = window.innerHeight - obstruction - (rect.top + window.scrollY)
      }
      const target = Math.floor(available - BOTTOM_GAP_PX)
      node.style.setProperty("--office-h", `${Math.max(MIN_HEIGHT_PX, target)}px`)
      const host = scroller ?? document.documentElement
      const overflow = host.scrollHeight - host.clientHeight
      if (overflow > 0 && target > MIN_HEIGHT_PX) node.style.setProperty("--office-h", `${Math.max(MIN_HEIGHT_PX, target - overflow)}px`)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener("resize", schedule)
    const observer = new ResizeObserver(schedule)
    if (node.parentElement) observer.observe(node.parentElement)
    observer.observe(document.body)
    const scroller = scrollParent(node)
    if (scroller) observer.observe(scroller)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", schedule)
      observer.disconnect()
    }
  }, [ref])
}
