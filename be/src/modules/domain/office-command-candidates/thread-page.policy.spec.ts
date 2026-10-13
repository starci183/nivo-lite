import type { MessageView } from "./office-command-candidates.contracts"
import { clampPageSize, isValidCursor, splitPage, THREAD_PAGE_MAX } from "./thread-page.policy"

const line = (id: string, createdAt: string): MessageView => ({
    id,
    author_kind: "human",
    author_name: "An",
    agent_id: null,
    staff_id: null,
    body: "hi",
    lead_id: null,
    work_item_id: null,
    created_at: createdAt,
})

describe("thread page policy", () => {
    it("forces the page size into 1..100", () => {
        expect(clampPageSize(20.9)).toBe(20)
        expect(clampPageSize(0)).toBe(1)
        expect(clampPageSize(5000)).toBe(THREAD_PAGE_MAX)
        expect(clampPageSize(Number.NaN)).toBe(1)
    })

    it("accepts a cursor with a timestamp and a uuid only", () => {
        const id = "0b6f0c5e-2d41-4f55-9c9a-7a1c2f3e4d5b"
        expect(isValidCursor({ createdAt: "2026-10-12T10:00:00.123456+00:00", id })).toBe(true)
        expect(isValidCursor({ createdAt: "yesterday", id })).toBe(false)
        expect(isValidCursor({ createdAt: "2026-10-12T10:00:00Z", id: "x" })).toBe(false)
    })

    it("hands out the next cursor only when the query found one more row than the page", () => {
        const rows = [line("m-3", "t3"), line("m-2", "t2"), line("m-1", "t1")]
        expect(splitPage(rows, 2)).toEqual({ messages: rows.slice(0, 2), next: { createdAt: "t2", id: "m-2" } })
        expect(splitPage(rows, 3)).toEqual({ messages: rows, next: null })
        expect(splitPage([], 3)).toEqual({ messages: [], next: null })
    })
})
