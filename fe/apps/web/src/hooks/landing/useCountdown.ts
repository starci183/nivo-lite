import { useSyncExternalStore } from "react"

/** What is left until a deadline, split into the four units the countdown shows. */
export interface CountdownLeft {
    readonly days: number
    readonly hours: number
    readonly minutes: number
    readonly seconds: number
}

const SECOND_MS = 1000
const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** One tick per second for every subscriber; the timer exists only while somebody listens. */
const subscribe = (onTick: () => void): (() => void) => {
    const timer = setInterval(onTick, SECOND_MS)
    return () => clearInterval(timer)
}

/** The current second; it changes once per second, which is what re-renders a subscriber. */
const currentSecond = (): number => Math.floor(Date.now() / SECOND_MS)

/** The server has no clock reading that the browser would agree with, so it renders the unresolved state. */
const serverSecond = (): number => 0

/** The time left until `endsAt` (an ISO instant), or null before the browser has a clock reading. */
export const useCountdown = (endsAt: string): CountdownLeft | null => {
    const second = useSyncExternalStore(subscribe, currentSecond, serverSecond)
    if (second === 0) return null
    const left = Math.max(0, Date.parse(endsAt) - second * SECOND_MS)
    return {
        days: Math.floor(left / DAY_MS),
        hours: Math.floor(left / HOUR_MS) % 24,
        minutes: Math.floor(left / MINUTE_MS) % 60,
        seconds: Math.floor(left / SECOND_MS) % 60,
    }
}
