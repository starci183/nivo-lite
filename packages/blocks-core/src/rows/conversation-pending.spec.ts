import { pendingReducer, pendingRowOf, slotWithPending } from "./conversation-pending"
import type { MessageRow, PendingSend } from "./conversation.types"

const ONE: PendingSend = { key: "p1", text: "one", afterId: "m9", state: "sending" }
const TWO: PendingSend = { key: "p2", text: "two", afterId: "m9", state: "sending" }

describe("pendingReducer", () => {
    it("queues a message as sending, after the ones before it", () => {
        expect(pendingReducer([ONE], { type: "queue", key: "p2", text: "two", afterId: "m9" })).toEqual([ONE, TWO])
    })

    it("fails, retries and completes only the message the key names", () => {
        const failed = pendingReducer([ONE, TWO], { type: "fail", key: "p1" })
        expect(failed).toEqual([{ ...ONE, state: "failed" }, TWO])
        expect(pendingReducer(failed, { type: "retry", key: "p1" })).toEqual([ONE, TWO])
        expect(pendingReducer([ONE, TWO], { type: "done", key: "p2" })).toEqual([ONE, { ...TWO, state: "sent" }])
    })

    it("discards the message the key names", () => {
        expect(pendingReducer([ONE, TWO], { type: "discard", key: "p1" })).toEqual([TWO])
    })

    it("settles a sent message once the thread has moved past the message it was written after", () => {
        const failed: PendingSend = { key: "p3", text: "three", afterId: "m9", state: "failed" }
        const sent: PendingSend = { ...ONE, state: "sent" }
        expect(pendingReducer([sent, TWO, failed], { type: "settle", lastId: "m10" })).toEqual([TWO, failed])
    })

    it("keeps a sent message while the thread has not moved, and the same list when nothing settles", () => {
        const sent: PendingSend = { ...ONE, state: "sent" }
        const pending = [sent, TWO]
        expect(pendingReducer(pending, { type: "settle", lastId: "m9" })).toBe(pending)
    })
})

describe("pendingRowOf", () => {
    it("draws a pending message as the viewer's own, marked by how far it has travelled", () => {
        expect(pendingRowOf(ONE)).toEqual({
            id: "p1",
            author: "",
            text: "one",
            side: "outgoing",
            atMs: null,
            mark: "",
            delivery: "queued",
        })
        expect(pendingRowOf({ ...ONE, state: "failed" }).delivery).toBe("failed")
        expect(pendingRowOf({ ...ONE, state: "sent" }).delivery).toBe("sent")
    })
})

describe("slotWithPending", () => {
    const SERVER: MessageRow = {
        id: "m1",
        author: "An",
        text: "hi",
        side: "incoming",
        atMs: 1,
        mark: "",
        delivery: null,
    }

    it("is the same slot when nothing is pending", () => {
        const slot = { items: [SERVER] }
        expect(slotWithPending(slot, [])).toBe(slot)
    })

    it("puts the pending messages after the ones the server holds and keeps the refresh mark", () => {
        const result = slotWithPending({ items: [SERVER], isValidating: true }, [ONE])
        expect(result).toEqual({ items: [SERVER, pendingRowOf(ONE)], isValidating: true })
    })

    it("shows the pending messages alone in a thread that holds none yet", () => {
        expect(slotWithPending({ isEmpty: true }, [ONE])).toEqual({ items: [pendingRowOf(ONE)] })
    })

    it("leaves a thread that is loading, failed or forbidden as it is", () => {
        expect(slotWithPending({ isLoading: true }, [ONE])).toEqual({ isLoading: true })
        expect(slotWithPending({ isError: true }, [ONE])).toEqual({ isError: true })
        expect(slotWithPending({ isForbidden: true }, [ONE])).toEqual({ isForbidden: true })
    })
})
