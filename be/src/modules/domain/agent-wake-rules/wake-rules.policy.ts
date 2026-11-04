import type { BackgroundCount, OptionalBreakerUntil } from "./agent-wake-rules.contracts"

/** The shape of a wake source key: it is stored as the wake's source, so the database checks the same shape. */
export const WAKE_SOURCE_KEY: RegExp = /^[a-z][a-z0-9_]{0,39}$/u

/** Whether the background cap of the day is spent; a count of another day is not. */
export const backgroundCapSpent = (state: BackgroundCount, cap: number, today: string): boolean =>
    state.backgroundDay === today && state.backgroundTurns >= cap

/** Whether the breaker is open at this moment. */
export const breakerOpen = (breakerUntil: OptionalBreakerUntil, now: Date): boolean =>
    breakerUntil !== null && breakerUntil.getTime() > now.getTime()
