"use client"

import { useEffect, useState } from "react"
import { CLOCK_TICK_MS } from "@/modules/work-threads"

/** The current instant in milliseconds, ticking once a second after mount; zero on the server so the first render never mismatches. */
export const useThreadClock = (): number => {
    const [now, setNow] = useState(0)
    useEffect(() => {
        const first = window.setTimeout(() => setNow(Date.now()), 0)
        const id = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
        return () => {
            window.clearTimeout(first)
            window.clearInterval(id)
        }
    }, [])
    return now
}
