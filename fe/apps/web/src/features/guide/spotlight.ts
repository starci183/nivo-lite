"use client"

import { useEffect } from "react"

/**
 * After the guide sends someone to a page, the place it named (`data-guide="<target>"`) is scrolled into view and outlined for a
 * moment. The target travels through sessionStorage so it survives the client navigation; the element is waited for while the page
 * streams in. The outline is the `[data-guide-spotlight="on"]` rule in globals.css.
 */

const KEY = "nivo.guide.spotlight"
const WAIT_MS = 5000
const SHOW_MS = 2600

export const queueSpotlight = (target: string) => {
  try {
    window.sessionStorage.setItem(KEY, target)
  } catch {
    // Without storage the jump still happens; only the highlight is skipped.
  }
}

const take = (): string | null => {
  try {
    const target = window.sessionStorage.getItem(KEY)
    if (target) window.sessionStorage.removeItem(KEY)
    return target
  } catch {
    return null
  }
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

const highlight = (target: string) => {
  const started = Date.now()
  let timer = 0
  const look = () => {
    const el = document.querySelector<HTMLElement>(`[data-guide="${CSS.escape(target)}"]`)
    if (el) {
      el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" })
      el.setAttribute("data-guide-spotlight", "on")
      timer = window.setTimeout(() => el.removeAttribute("data-guide-spotlight"), SHOW_MS)
      return
    }
    if (Date.now() - started < WAIT_MS) timer = window.setTimeout(look, 150)
  }
  look()
  return () => window.clearTimeout(timer)
}

/** Highlights a queued target whenever the path changes, or on the `nivo-guide-spotlight` event (target on the current page). */
export const useGuideSpotlight = (pathname: string) => {
  useEffect(() => {
    let stop: (() => void) | undefined
    const run = () => {
      const target = take()
      if (target) {
        stop?.()
        stop = highlight(target)
      }
    }
    run()
    window.addEventListener("nivo-guide-spotlight", run)
    return () => {
      window.removeEventListener("nivo-guide-spotlight", run)
      stop?.()
    }
  }, [pathname])
}
