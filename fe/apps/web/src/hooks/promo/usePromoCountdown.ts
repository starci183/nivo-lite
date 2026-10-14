"use client"

import { useEffect, useState } from "react"

/** The time left until an instant, split into the units a countdown shows. */
type PromoRemaining = {
    readonly days: number
    readonly hours: number
    readonly minutes: number
    readonly seconds: number
}

const remainingAt = (endsAt: string, now: number): PromoRemaining => {
    const ms = Math.max(0, Date.parse(endsAt) - now)
    return {
        days: Math.floor(ms / 86_400_000),
        hours: Math.floor(ms / 3_600_000) % 24,
        minutes: Math.floor(ms / 60_000) % 60,
        seconds: Math.floor(ms / 1000) % 60,
    }
}

/** Ticks once a second after mount; null on the server so the first render never mismatches. */
export const usePromoCountdown = (endsAt: string): PromoRemaining | null => {
    const [left, setLeft] = useState<PromoRemaining | null>(null)
    useEffect(() => {
        const tick = () => setLeft(remainingAt(endsAt, Date.now()))
        const first = window.setTimeout(tick, 0)
        const id = window.setInterval(tick, 1000)
        return () => {
            window.clearTimeout(first)
            window.clearInterval(id)
        }
    }, [endsAt])
    return left
}
