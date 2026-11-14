import type { TeamChatReactionView } from "@/modules/types"

/** How long the taps of a burst wait for one more before they go as one call (milliseconds). */
export const REACTION_BURST_MS = 600

/** The most taps one call carries: the door refuses a call with more, so a longer burst goes as several calls. */
export const REACTION_TIMES_MAX = 30

/** The key of one emoji on one message. */
export const reactionKeyOf = (messageId: string, emoji: string): string => `${messageId}\u0000${emoji}`

/** The reactions once `taps` more of `emoji` were tapped by the viewer, the most tapped first (a new emoji joins at the end of equals). */
export const withTaps = (
    reactions: ReadonlyArray<TeamChatReactionView>,
    emoji: string,
    taps: number,
): ReadonlyArray<TeamChatReactionView> => {
    if (taps <= 0) return reactions
    const held = reactions.some((reaction) => reaction.emoji === emoji)
    const grown = held
        ? reactions.map((reaction) =>
              reaction.emoji === emoji
                  ? { ...reaction, count: reaction.count + taps, mine: reaction.mine + taps }
                  : reaction,
          )
        : [...reactions, { emoji, count: taps, mine: taps }]
    return grown.toSorted((left, right) => right.count - left.count)
}

/** The reactions of a message with the taps that are not yet confirmed laid over them. */
export const withPendingTaps = (
    messageId: string,
    reactions: ReadonlyArray<TeamChatReactionView>,
    pending: ReadonlyMap<string, number>,
): ReadonlyArray<TeamChatReactionView> => {
    if (pending.size === 0) return reactions
    const prefix = `${messageId}\u0000`
    return [...pending.entries()].reduce(
        (shown, [key, taps]) => (key.startsWith(prefix) ? withTaps(shown, key.slice(prefix.length), taps) : shown),
        reactions,
    )
}

/** The message and the emoji a key names. */
const keyParts = (key: string): [string, string] => {
    const [messageId = "", emoji = ""] = key.split("\u0000")
    return [messageId, emoji]
}

/** One burst, ready to go: the taps of one emoji on one message. */
export interface ReactionBatch {
    readonly messageId: string
    readonly emoji: string
    readonly times: number
}

/** What collects the taps of a burst and sends them. */
export interface ReactionBatcher {
    /** One more tap; the burst goes 600 ms after the last tap, or at once when it holds as many taps as a call carries. */
    readonly tap: (messageId: string, emoji: string) => void
    /** Sends every burst that is waiting now (the room closes). */
    readonly flush: () => void
}

/** The clock of a batcher: a spec drives it by hand. */
export interface BatcherClock {
    readonly after: (ms: number, run: () => void) => () => void
}

/** The clock of the browser. */
export const BROWSER_CLOCK: BatcherClock = {
    after: (ms, run) => {
        const timer = setTimeout(run, ms)
        return () => clearTimeout(timer)
    },
}

/** A burst that is collecting taps. */
interface Burst {
    times: number
    cancel: () => void
}

/**
 * Collects taps per emoji and message: the taps within 600 ms of each other go as one call with `times`. A burst that fills a call
 * goes at once. Only one call per emoji and message is in flight; taps made meanwhile wait for it and go in the next call, so the
 * door's pace rule never refuses two calls that overlap.
 */
export const createReactionBatcher = (
    send: (batch: ReactionBatch) => Promise<void>,
    clock: BatcherClock = BROWSER_CLOCK,
): ReactionBatcher => {
    const bursts = new Map<string, Burst>()
    const inFlight = new Set<string>()
    const release = (key: string): void => {
        inFlight.delete(key)
        if (bursts.has(key)) flushKey(key)
    }
    const flushKey = (key: string): void => {
        const burst = bursts.get(key)
        if (burst === undefined || inFlight.has(key)) return
        burst.cancel()
        bursts.delete(key)
        inFlight.add(key)
        const [messageId, emoji] = keyParts(key)
        void send({ messageId, emoji, times: Math.min(burst.times, REACTION_TIMES_MAX) }).finally(() => release(key))
        if (burst.times > REACTION_TIMES_MAX)
            bursts.set(key, { times: burst.times - REACTION_TIMES_MAX, cancel: () => undefined })
    }
    return {
        tap: (messageId, emoji) => {
            const key = reactionKeyOf(messageId, emoji)
            const burst = bursts.get(key)
            burst?.cancel()
            const times = (burst?.times ?? 0) + 1
            const next: Burst = { times, cancel: clock.after(REACTION_BURST_MS, () => flushKey(key)) }
            bursts.set(key, next)
            if (times >= REACTION_TIMES_MAX) flushKey(key)
        },
        flush: () => {
            const keys = [...bursts.keys()]
            keys.forEach((entry) => flushKey(entry))
        },
    }
}

/** The taps the viewer made that the door has not confirmed yet, by emoji and message: the thread lays them over what it read. */
export interface PendingTaps {
    readonly add: (messageId: string, emoji: string, taps: number) => void
    readonly subtract: (messageId: string, emoji: string, taps: number) => void
    readonly subscribe: (listener: () => void) => () => void
    readonly snapshot: () => ReadonlyMap<string, number>
}

/** A store of the unconfirmed taps; every change makes a new map, so a reader can compare snapshots by identity. */
export const createPendingTaps = (): PendingTaps => {
    let held: ReadonlyMap<string, number> = new Map()
    const listeners = new Set<() => void>()
    const change = (messageId: string, emoji: string, delta: number): void => {
        const key = reactionKeyOf(messageId, emoji)
        const next = new Map(held)
        const taps = (next.get(key) ?? 0) + delta
        if (taps > 0) next.set(key, taps)
        else next.delete(key)
        held = next
        for (const listener of listeners) listener()
    }
    return {
        add: (messageId, emoji, taps) => change(messageId, emoji, taps),
        subtract: (messageId, emoji, taps) => change(messageId, emoji, -taps),
        subscribe: (listener) => {
            listeners.add(listener)
            return () => void listeners.delete(listener)
        },
        snapshot: () => held,
    }
}
