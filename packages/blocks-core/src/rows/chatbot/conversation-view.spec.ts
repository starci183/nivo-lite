import { entriesOf } from "./conversation"
import type { MessageRow } from "./conversation.types"
import { threadViewOf } from "./conversation-view"

const NOON = Date.parse("2026-11-04T12:00:00.000Z")
const WORDS = {
    today: "Today",
    yesterday: "Yesterday",
    delivery: { queued: "Sending", sent: "Sent", failed: "Not sent", unknown: "Unknown" },
}
const CLOCK = { locale: "en", zone: "UTC", nowMs: NOON }

const row = (overrides: Partial<MessageRow>): MessageRow => ({
    id: "m",
    author: "An",
    text: "hi",
    side: "incoming",
    atMs: NOON,
    mark: "",
    delivery: null,
    ...overrides,
})

const viewOf = (rows: ReadonlyArray<MessageRow>, retryable: ReadonlySet<string> = new Set()) =>
    threadViewOf(entriesOf(rows, "UTC"), WORDS, CLOCK, retryable)

describe("threadViewOf", () => {
    it("names the current day by word and an earlier day by its date", () => {
        const view = viewOf([row({ id: "1", atMs: NOON - 5 * 86_400_000 }), row({ id: "2" })])
        expect(view.filter((entry) => entry.kind === "day").map((entry) => entry.label)).toEqual([
            "October 30, 2026",
            "Today",
        ])
    })

    it("names yesterday by word", () => {
        const view = viewOf([row({ id: "1", atMs: NOON - 86_400_000 })])
        expect(view[0]).toEqual({ kind: "day", id: "day-2026-11-03", label: "Yesterday" })
    })

    it("draws a notice as a line of its own", () => {
        const view = viewOf([row({ id: "1", side: "notice", text: "A person joined", author: "" })])
        expect(view[1]).toEqual({ kind: "notice", id: "1", text: "A person joined" })
    })

    it("gives the first message of a group its author, mark and avatar and leaves them out of the rest", () => {
        const view = viewOf([row({ id: "1", mark: "AI" }), row({ id: "2", atMs: NOON + 1000, mark: "AI" })])
        expect(view[1]).toMatchObject({ author: "An", mark: "AI", hasAvatar: true, meta: "12:00" })
        expect(view[2]).toMatchObject({ author: "", mark: "", hasAvatar: false })
    })

    it("draws no avatar for the viewer's own messages or for an author without a name", () => {
        const view = viewOf([row({ id: "1", side: "outgoing" }), row({ id: "2", author: "", atMs: NOON + 1_000_000 })])
        expect(view[1]).toMatchObject({ side: "outgoing", hasAvatar: false })
        expect(view[2]).toMatchObject({ side: "incoming", hasAvatar: false })
    })

    it("gives an outgoing message the soft tint when the AI wrote it, the brand fill when the reader did, and the brand tone to what is incoming", () => {
        const view = viewOf([
            row({ id: "1", side: "outgoing", mark: "AI" }),
            row({ id: "2", side: "outgoing", atMs: NOON + 1_000_000 }),
            row({ id: "3", mark: "AI", atMs: NOON + 2_000_000 }),
        ])
        expect(view.filter((entry) => entry.kind === "message").map((entry) => entry.tone)).toEqual([
            "soft",
            "brand",
            "brand",
        ])
    })

    it("marks delivery with its words and offers a retry only for a failed message that can be retried", () => {
        const rows = [
            row({ id: "a", side: "outgoing", delivery: "sent" }),
            row({ id: "b", side: "outgoing", delivery: "failed", atMs: NOON + 1_000_000 }),
            row({ id: "c", side: "outgoing", delivery: "failed", atMs: NOON + 2_000_000 }),
            row({ id: "d", side: "outgoing", atMs: NOON + 3_000_000 }),
        ]
        const view = viewOf(rows, new Set(["b"]))
        const messages = view.flatMap((entry) => (entry.kind === "message" ? [entry] : []))
        expect(messages.map((entry) => entry.delivery)).toEqual([
            { state: "sent", label: "Sent" },
            { state: "failed", label: "Not sent" },
            { state: "failed", label: "Not sent" },
            null,
        ])
        expect(messages.map((entry) => entry.canRetry)).toEqual([false, true, false, false])
    })

    it("leaves the time of a message without one empty", () => {
        const view = viewOf([row({ id: "1", atMs: null })])
        expect(view).toEqual([expect.objectContaining({ kind: "message", meta: "" })])
    })
})
