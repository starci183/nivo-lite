import type { GraphBurst, GraphSpecTrigger, GraphTagSource } from "./graph-spec.types"

/** The longest burst window a flow may ask for, in milliseconds. */
export const BURST_WINDOW_MAX_MS = 60_000

/** The longest wait a flow may ask for, in milliseconds. */
export const BURST_MAX_WAIT_MAX_MS = 120_000

/** The spellings of a duration, each with the milliseconds one of its unit lasts. */
const DURATIONS: ReadonlyArray<readonly [RegExp, number]> = [
    [/^(\d{1,6})ms$/u, 1],
    [/^(\d{1,6})s$/u, 1000],
    [/^(\d{1,6})m$/u, 60_000],
]

/** A duration as a flow writes it ("0s", "6s", "1500ms", "2m") in milliseconds, or null when it is not one. */
export const parseBurstDuration = (text: string): number | null => {
    for (const [pattern, unitMs] of DURATIONS) {
        const amount = pattern.exec(text)?.[1]
        if (amount !== undefined) return Number(amount) * unitMs
    }
    return null
}

/** What a flow asked of a source, in milliseconds: the window (0 turns it off) and the longest wait, none when the flow names none. */
export interface BurstSetting {
    /** How long the conversation must be quiet before the agent answers. */
    readonly windowMs: number
    /** The longest the burst may keep the agent waiting; null leaves it to the app's default. */
    readonly maxWaitMs: number | null
}

/** True when the entry is a duration in range, the longest wait is one too and no shorter than the window. */
export const burstIsSound = (burst: GraphBurst): boolean => {
    const windowMs = parseBurstDuration(burst.window)
    const maxWaitMs = burst.maxWait === undefined ? null : parseBurstDuration(burst.maxWait)
    if (windowMs === null || windowMs > BURST_WINDOW_MAX_MS) return false
    if (burst.maxWait === undefined) return true
    return maxWaitMs !== null && maxWaitMs <= BURST_MAX_WAIT_MAX_MS && maxWaitMs >= windowMs
}

/** What the flow's trigger asks for a source, or null when it asks nothing or the entry is not sound. */
export const burstOf = (trigger: GraphSpecTrigger, source: GraphTagSource): BurstSetting | null => {
    const burst = trigger.burst?.[source]
    const windowMs = burst === undefined ? null : parseBurstDuration(burst.window)
    if (burst === undefined || windowMs === null || !burstIsSound(burst)) return null
    return { windowMs, maxWaitMs: burst.maxWait === undefined ? null : parseBurstDuration(burst.maxWait) }
}
