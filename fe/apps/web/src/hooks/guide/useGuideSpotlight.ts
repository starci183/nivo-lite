"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * After the guide sends someone to a page, the place it named (`data-guide-id="<target>"`) is scrolled into view and ringed with a
 * pulsing outline for about three seconds. The target is held in memory so it survives the client navigation; the element is waited
 * for while the page streams in. Grammar has no spotlight yet, so the ring is the outline utilities of RING, added to the element and
 * taken off again; the pulse alternates the ring between the accent and clear.
 * A marker may wrap its control in an element without a box of its own (`display: contents`); the ring then goes to its first child.
 */

/** The utilities that ring the spotlighted element. */
const RING = ["outline-2", "outline-solid", "outline-offset-4", "rounded-(--radius)", "transition-[outline-color]", "duration-500"]
const ON = "outline-accent"
const OFF = "outline-transparent"

const WAIT_MS = 5000
const SHOW_MS = 3000
const BEAT_MS = 500
const LOOK_MS = 150
const LOOKS = Math.ceil(WAIT_MS / LOOK_MS)

/** The element that draws the ring: the marker, or its first child when the marker has no box. */
const boxOf = (marker: HTMLElement): HTMLElement =>
    window.getComputedStyle(marker).display === "contents" && marker.firstElementChild instanceof HTMLElement
        ? marker.firstElementChild
        : marker

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
        let left = LOOKS
        let timer: ReturnType<typeof setTimeout> | undefined
        let outlined: HTMLElement | null = null
        let beat: ReturnType<typeof setInterval> | undefined
        const clear = (element: HTMLElement) => {
            clearInterval(beat)
            element.classList.remove(...RING, ON, OFF)
        }
        const look = () => {
            const marker = document.querySelector<HTMLElement>(`[data-guide-id="${CSS.escape(target)}"]`)
            if (marker) {
                const element = boxOf(marker)
                const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
                element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" })
                element.classList.add(...RING, ON)
                outlined = element
                let beats = 0
                beat = setInterval(() => {
                    beats += 1
                    element.classList.toggle(ON, beats % 2 === 0)
                    element.classList.toggle(OFF, beats % 2 === 1)
                }, BEAT_MS)
                timer = setTimeout(() => clear(element), SHOW_MS)
                return
            }
            left -= 1
            if (left > 0) timer = setTimeout(look, LOOK_MS)
        }
        look()
        return () => {
            clearTimeout(timer)
            if (outlined !== null) clear(outlined)
        }
    }, [pathname, jumps])
    return useCallback((target, isHere) => {
        if (target === undefined) return
        queuedTarget = target
        if (isHere) setJumps((count) => count + 1)
    }, [])
}
