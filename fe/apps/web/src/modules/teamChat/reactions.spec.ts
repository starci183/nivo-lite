import {
    REACTION_BURST_MS,
    REACTION_TIMES_MAX,
    createPendingTaps,
    createReactionBatcher,
    reactionKeyOf,
    withPendingTaps,
    withTaps,
} from "./reactions"
import type { BatcherClock, ReactionBatch } from "./reactions"

const MSG = "message-1"
const MSG2 = "message-2"
const HEART = "heart"
const THUMB = "thumb"

/** A clock a spec turns by hand. */
const manualClock = () => {
    let now = 0
    let next = 0
    const timers = new Map<number, { readonly at: number; readonly run: () => void }>()
    const clock: BatcherClock = {
        after: (ms, run) => {
            const id = next++
            timers.set(id, { at: now + ms, run })
            return () => void timers.delete(id)
        },
    }
    const advance = (ms: number): void => {
        now += ms
        for (const [id, timer] of [...timers.entries()].toSorted((left, right) => left[1].at - right[1].at)) {
            if (timer.at <= now && timers.has(id)) {
                timers.delete(id)
                timer.run()
            }
        }
    }
    return { clock, advance }
}

/** A sender that records the batches and settles each when the spec says. */
const recorder = () => {
    const batches: Array<ReactionBatch> = []
    const settle: Array<() => void> = []
    const send = (batch: ReactionBatch): Promise<void> => {
        batches.push(batch)
        return new Promise<void>((resolve) => settle.push(resolve))
    }
    return { batches, settle, send }
}

const flushMicrotasks = async (): Promise<void> => {
    await Promise.resolve()
    await Promise.resolve()
}

describe("withTaps", () => {
    it("adds the taps to the emoji of the viewer and to its total", () => {
        const next = withTaps([{ emoji: HEART, count: 4, mine: 1 }], HEART, 3)
        expect(next).toEqual([{ emoji: HEART, count: 7, mine: 4 }])
    })

    it("adds a new emoji and keeps the most tapped first", () => {
        const next = withTaps(
            [
                { emoji: HEART, count: 2, mine: 0 },
                { emoji: THUMB, count: 1, mine: 0 },
            ],
            THUMB,
            3,
        )
        expect(next.map((reaction) => reaction.emoji)).toEqual([THUMB, HEART])
        expect(withTaps([], HEART, 1)).toEqual([{ emoji: HEART, count: 1, mine: 1 }])
    })

    it("changes nothing for no tap", () => {
        const held = [{ emoji: HEART, count: 2, mine: 0 }]
        expect(withTaps(held, HEART, 0)).toBe(held)
    })
})

describe("withPendingTaps", () => {
    it("lays only the pending taps of the message over its reactions", () => {
        const pending = new Map([
            [reactionKeyOf(MSG, HEART), 2],
            [reactionKeyOf(MSG, THUMB), 1],
            [reactionKeyOf(MSG2, HEART), 9],
        ])
        const shown = withPendingTaps(MSG, [{ emoji: HEART, count: 1, mine: 0 }], pending)
        expect(shown).toEqual([
            { emoji: HEART, count: 3, mine: 2 },
            { emoji: THUMB, count: 1, mine: 1 },
        ])
    })

    it("hands the reactions back as they are when nothing is pending", () => {
        const held = [{ emoji: HEART, count: 1, mine: 0 }]
        expect(withPendingTaps(MSG, held, new Map())).toBe(held)
    })
})

describe("createPendingTaps", () => {
    it("adds and subtracts taps, drops an emoji that reaches zero, and tells the readers on each change", () => {
        const store = createPendingTaps()
        const listener = jest.fn()
        const stop = store.subscribe(listener)
        store.add(MSG, HEART, 1)
        store.add(MSG, HEART, 1)
        expect(store.snapshot().get(reactionKeyOf(MSG, HEART))).toBe(2)
        const before = store.snapshot()
        store.subtract(MSG, HEART, 2)
        expect(store.snapshot().size).toBe(0)
        expect(store.snapshot()).not.toBe(before)
        expect(listener).toHaveBeenCalledTimes(3)
        stop()
        store.add(MSG, HEART, 1)
        expect(listener).toHaveBeenCalledTimes(3)
    })
})

describe("createReactionBatcher", () => {
    it("sends the taps within the burst window as one call with times", () => {
        const { clock, advance } = manualClock()
        const { batches, send } = recorder()
        const batcher = createReactionBatcher(send, clock)
        batcher.tap(MSG, HEART)
        advance(REACTION_BURST_MS - 1)
        batcher.tap(MSG, HEART)
        advance(REACTION_BURST_MS - 1)
        batcher.tap(MSG, HEART)
        expect(batches).toEqual([])
        advance(REACTION_BURST_MS)
        expect(batches).toEqual([{ messageId: MSG, emoji: HEART, times: 3 }])
    })

    it("keeps a burst of each emoji and of each message apart", () => {
        const { clock, advance } = manualClock()
        const { batches, send } = recorder()
        const batcher = createReactionBatcher(send, clock)
        batcher.tap(MSG, HEART)
        batcher.tap(MSG, THUMB)
        batcher.tap(MSG2, HEART)
        batcher.tap(MSG2, HEART)
        advance(REACTION_BURST_MS)
        expect(batches).toHaveLength(3)
        expect(batches).toEqual(
            expect.arrayContaining([
                { messageId: MSG, emoji: HEART, times: 1 },
                { messageId: MSG, emoji: THUMB, times: 1 },
                { messageId: MSG2, emoji: HEART, times: 2 },
            ]),
        )
    })

    it("sends a burst at once when it holds as many taps as a call carries", () => {
        const { clock } = manualClock()
        const { batches, send } = recorder()
        const batcher = createReactionBatcher(send, clock)
        for (let tap = 0; tap < REACTION_TIMES_MAX; tap += 1) batcher.tap(MSG, HEART)
        expect(batches).toEqual([{ messageId: MSG, emoji: HEART, times: REACTION_TIMES_MAX }])
    })

    it("holds the taps made while a call is in flight and sends them when it settles", async () => {
        const { clock, advance } = manualClock()
        const { batches, settle, send } = recorder()
        const batcher = createReactionBatcher(send, clock)
        batcher.tap(MSG, HEART)
        advance(REACTION_BURST_MS)
        batcher.tap(MSG, HEART)
        batcher.tap(MSG, HEART)
        advance(REACTION_BURST_MS)
        expect(batches).toEqual([{ messageId: MSG, emoji: HEART, times: 1 }])
        settle[0]?.()
        await flushMicrotasks()
        expect(batches).toEqual([
            { messageId: MSG, emoji: HEART, times: 1 },
            { messageId: MSG, emoji: HEART, times: 2 },
        ])
    })

    it("sends what is waiting when flushed, and nothing twice", () => {
        const { clock, advance } = manualClock()
        const { batches, send } = recorder()
        const batcher = createReactionBatcher(send, clock)
        batcher.tap(MSG, HEART)
        batcher.tap(MSG, HEART)
        batcher.flush()
        expect(batches).toEqual([{ messageId: MSG, emoji: HEART, times: 2 }])
        advance(REACTION_BURST_MS * 2)
        batcher.flush()
        expect(batches).toHaveLength(1)
    })
})
