import { EMPTY_TAIL, TAIL_TEXT_MAX, tailAfter } from "./conversation-tail"
import { PREVIEW_MAX } from "./message"

describe("tailAfter", () => {
    it("makes a spoken line the preview and counts it", () => {
        const tail = tailAfter(EMPTY_TAIL, { role: "user", text: "Hi", at: "2026-11-05T01:00:00.000Z" })
        expect(tail).toEqual({
            lastText: "Hi",
            lastRole: "user",
            lastAt: "2026-11-05T01:00:00.000Z",
            messageCount: 1,
        })
        const next = tailAfter(tail, { role: "agent", text: "Hello", at: "2026-11-05T01:00:05.000Z" })
        expect(next).toEqual({
            lastText: "Hello",
            lastRole: "agent",
            lastAt: "2026-11-05T01:00:05.000Z",
            messageCount: 2,
        })
    })

    it("cuts a long line to the preview, which never passes the limit of a tail", () => {
        const tail = tailAfter(EMPTY_TAIL, { role: "user", text: "x".repeat(PREVIEW_MAX + 10), at: "t" })
        expect(tail.lastText).toHaveLength(PREVIEW_MAX + 2)
        expect(tail.lastText.length).toBeLessThanOrEqual(TAIL_TEXT_MAX)
    })

    it("shows a system line as the preview only while nobody has spoken, and never counts it", () => {
        const first = tailAfter(EMPTY_TAIL, { role: "system", text: "Ha took over", at: "t1" })
        expect(first).toEqual({ lastText: "Ha took over", lastRole: null, lastAt: "t1", messageCount: 0 })
        const spoken = tailAfter(first, { role: "user", text: "Hi", at: "t2" })
        const later = tailAfter(spoken, { role: "system", text: "Ha released it", at: "t3" })
        expect(later).toEqual({ lastText: "Hi", lastRole: "user", lastAt: "t3", messageCount: 1 })
    })
})
