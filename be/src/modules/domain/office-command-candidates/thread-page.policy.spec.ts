import { Test } from "@nestjs/testing"

import type { MessageView } from "./office-command-candidates.contracts"

import {
    clampPageSize as realClampPageSize,
    isValidCursor as realIsValidCursor,
    splitPage as realSplitPage,
    THREAD_PAGE_MAX,
} from "./thread-page.policy"

const SUBJECT = Symbol("thread-page.policy")

const functions = { clampPageSize: realClampPageSize, isValidCursor: realIsValidCursor, splitPage: realSplitPage }

const line = (id: string, createdAt: string): MessageView => ({
    id,
    author_kind: "human",
    author_name: "An",
    author_user_id: null,
    agent_id: null,
    staff_id: null,
    body: "hi",
    lead_id: null,
    work_item_id: null,
    lead_name: null,
    department: null,
    room: null,
    card_json: null,
    card_state: null,
    created_at: createdAt,
})

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    clampPageSize: realClampPageSize,
                    isValidCursor: realIsValidCursor,
                    splitPage: realSplitPage,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<typeof functions>(SUBJECT)

    return { subject }
}

describe("thread page policy", () => {
    it("forces the page size into 1..100", async () => {
        const { subject } = await buildSubject()

        expect(subject.clampPageSize(20.9)).toBe(20)
        expect(subject.clampPageSize(0)).toBe(1)
        expect(subject.clampPageSize(5000)).toBe(THREAD_PAGE_MAX)
        expect(subject.clampPageSize(Number.NaN)).toBe(1)
    })

    it("accepts a cursor with a timestamp and a uuid only", async () => {
        const { subject } = await buildSubject()

        const id = "0b6f0c5e-2d41-4f55-9c9a-7a1c2f3e4d5b"
        expect(subject.isValidCursor({ createdAt: "2026-10-12T10:00:00.123456+00:00", id })).toBe(true)
        expect(subject.isValidCursor({ createdAt: "yesterday", id })).toBe(false)
        expect(subject.isValidCursor({ createdAt: "2026-10-12T10:00:00Z", id: "x" })).toBe(false)
    })

    it("hands out the next cursor only when the query found one more row than the page", async () => {
        const { subject } = await buildSubject()

        const rows = [line("m-3", "t3"), line("m-2", "t2"), line("m-1", "t1")]
        expect(subject.splitPage(rows, 2)).toEqual({
            messages: rows.slice(0, 2),
            next: { createdAt: "t2", id: "m-2" },
        })
        expect(subject.splitPage(rows, 3)).toEqual({ messages: rows, next: null })
        expect(subject.splitPage([], 3)).toEqual({ messages: [], next: null })
    })
})
