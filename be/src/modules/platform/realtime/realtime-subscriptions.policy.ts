import { RealtimeError, RealtimeErrorCode } from "./errors/realtime.error"
import type { RealtimeTopic } from "./realtime.port"

/** One published frame as a shared hub loads it: the topic, the frame and the position that orders it (and tells replay from live). */
export interface Entry {
    /** The topic the frame was published to. */
    readonly topic: string
    /** The frame, as the store holds it; a subscription delivers it only when its topic accepts it. */
    readonly frame: object
    /** The table sequence number or stream id of the entry; the same frame carries the same position in a replay and in a live push. */
    readonly position: string
}

/** The retained entries and the store position observed when this subscription began. */
export interface Replay {
    /** Explicit retained replay, oldest first, before live entries held while the store was read. */
    readonly entries: ReadonlyArray<Entry>
    /** The topic tail observed at join, even when the client requested no retained replay. */
    readonly position?: string
}

/** Orders the store positions of one hub; the memory hub has no ordered positions. */
export type ComparePositions = (left: string, right: string) => number

/** One open subscription of this replica, with its own last position rather than a shared topic cursor. */
interface Receiver {
    readonly receive: (entries: ReadonlyArray<Entry>) => void
    last: string | undefined
    readonly release: () => void
}

/** How the replay of a subscription ended: loaded, or failed with the cause the store gave. */
interface ReplayOutcome {
    readonly failed: boolean
    readonly cause: unknown
}

/**
 * The subscriptions of one replica, shared by the shared hubs and the memory hub. A subscription joins its topic first, so nothing
 * published from then on is missed; the replay after `Last-Event-ID` is loaded once, and live entries that arrive while it loads
 * wait. Ordered hubs drop every entry already taken by that receiver, including live duplicates after its replay; memory only
 * drops replay duplicates held while loading. Releasing the reader, or failing its replay, releases the subscription.
 */
export class RealtimeSubscriptionsPolicy {
    private readonly open = new Map<string, Set<Receiver>>()

    /** Ordered hubs provide their comparator and zero position, so a still-loading receiver cannot hide outage frames. */
    constructor(
        private readonly compare?: ComparePositions,
        private readonly initialPosition?: string,
    ) {}

    /** The topics at least one subscription of this replica follows. */
    topics(): Array<string> {
        return [...this.open.keys()]
    }

    /** True when a subscription of this replica follows the topic. */
    follows(topic: string): boolean {
        return this.open.has(topic)
    }

    /** How many subscriptions of the topic are open on this replica. */
    count(topic: string): number {
        return this.open.get(topic)?.size ?? 0
    }

    /** The oldest position still owed by an open receiver; a released topic has no reload floor. */
    floorOf(topic: string): string | undefined {
        const compare = this.compare
        if (compare === undefined) return undefined
        let floor: string | undefined
        for (const receiver of this.open.get(topic) ?? []) {
            if (receiver.last === undefined) return undefined
            if (floor === undefined || compare(receiver.last, floor) < 0) floor = receiver.last
        }
        return floor
    }

    /** Hands each entry to the subscriptions of its topic, in order. */
    fanOut(entries: ReadonlyArray<Entry>): void {
        for (const entry of entries) {
            for (const receiver of this.open.get(entry.topic) ?? []) receiver.receive([entry])
        }
    }

    /** Opens one subscription whose first frames are the (still loading) replay. */
    join<T extends object>(topic: RealtimeTopic<T>, replay: Promise<Replay>): AsyncIterator<T> {
        const waiting: Array<T> = []
        const held: Array<Entry> = []
        let ready = false
        let closed = false
        let wake: (() => void) | undefined
        const take = (entries: ReadonlyArray<Entry>): void => {
            for (const entry of entries) {
                if (this.compare !== undefined && entry.position !== "") {
                    if (receiver.last !== undefined && this.compare(entry.position, receiver.last) <= 0) continue
                    receiver.last = entry.position
                }
                if (topic.accepts(entry.frame)) waiting.push(entry.frame)
            }
            wake?.()
        }
        const receiver: Receiver = {
            receive: (entries) => (ready ? take(entries) : held.push(...entries)),
            last: this.initialPosition,
            release: () => release(),
        }
        const receivers = this.open.get(topic.name) ?? new Set<Receiver>()
        receivers.add(receiver)
        this.open.set(topic.name, receivers)
        const release = (): void => {
            if (closed) return
            closed = true
            receivers.delete(receiver)
            if (receivers.size === 0) this.open.delete(topic.name)
            wake?.()
        }
        const settled: Promise<ReplayOutcome> = replay.then(
            (replayed) => {
                const positions = new Set(replayed.entries.map((entry) => entry.position))
                take(replayed.entries)
                if (
                    this.compare !== undefined &&
                    replayed.position !== undefined &&
                    (receiver.last === undefined || this.compare(replayed.position, receiver.last) > 0)
                )
                    receiver.last = replayed.position
                ready = true
                take(held.splice(0).filter((entry) => !positions.has(entry.position)))
                return { failed: false, cause: null }
            },
            (cause: unknown) => ({ failed: true, cause }),
        )
        return {
            next: async function next(): Promise<IteratorResult<T>> {
                const outcome = await settled
                if (outcome.failed) {
                    release()
                    throw new RealtimeError({
                        code: RealtimeErrorCode.ReplayFailed,
                        params: { topic: topic.name },
                        cause: outcome.cause,
                    })
                }
                if (waiting.length === 0 && !closed) {
                    await new Promise<void>((resolve) => {
                        wake = resolve
                    })
                    return next()
                }
                const frame = waiting.shift()
                return frame === undefined ? { done: true, value: undefined } : { done: false, value: frame }
            },
            return: () => {
                release()
                return Promise.resolve({ done: true, value: undefined })
            },
        }
    }

    /** Ends every open subscription: a reader waiting for a frame ends, and the replica follows no topic any more. */
    close(): void {
        for (const receivers of this.open.values()) {
            for (const receiver of receivers) receiver.release()
        }
    }
}
