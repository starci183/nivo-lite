"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * After the guide sends someone to a page, the place it named (`data-guide="<target>"`) is scrolled into view and outlined for a
 * moment. The target is held in memory so it survives the client navigation; the element is waited for while the page streams in.
 * The outline is drawn with the Tailwind utilities of SPOTLIGHT, added to the element and taken off again.
 */

/** The utilities that outline the spotlighted element. */
const SPOTLIGHT = [
    "outline-2",
    "outline-solid",
    "outline-accent",
    "outline-offset-4",
    "rounded-xl",
    "transition-[outline-color]",
]

const WAIT_MS = 5000
const SHOW_MS = 2600
const LOOK_MS = 150

/** The target waiting for the next page to show it. */
let queuedTarget: string | null = null

/** Takes the queued target, leaving none behind. */
const takeQueued = (): string | null => {
    try {
        return queuedTarget
    } finally {
        queuedTarget = null
    }
}

/**
 * Highlights a queued target whenever the path changes. The returned function queues a target for the page a link opens and, when
 * that page is the current one, highlights it at once.
 */
export const useGuideSpotlight = (pathname: string): ((target: string | undefined, isHere: boolean) => void) => {
    const [jumps, setJumps] = useState(0)
    useEffect(() => {
        const target = takeQueued()
        if (target === null) return undefined
        let attempts = 0
        let timer: ReturnType<typeof setTimeout> | undefined
        let outlined: HTMLElement | null = null
        const look = () => {
            const element = document.querySelector<HTMLElement>(`[data-guide="${CSS.escape(target)}"]`)
            if (element) {
                const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
                element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" })
                element.classList.add(...SPOTLIGHT)
                outlined = element
                timer = setTimeout(() => element.classList.remove(...SPOTLIGHT), SHOW_MS)
                return
            }
            attempts += 1
            if (attempts * LOOK_MS < WAIT_MS) timer = setTimeout(look, LOOK_MS)
        }
        look()
        return () => {
            clearTimeout(timer)
            outlined?.classList.remove(...SPOTLIGHT)
        }
    }, [pathname, jumps])
    return useCallback((target, isHere) => {
        if (target === undefined) return
        queuedTarget = target
        if (isHere) setJumps((count) => count + 1)
    }, [])
}
