import { builder } from "@starci/jest-preset"
import { conversationFacts, median, vnDayStart } from "./leadgen-conversations.mapper"
import type { LeadGenMessageRow, LeadGenWorkbenchRow } from "./persistence/leadgen-workbench.rows"

const NOW = Date.parse("2026-10-12T12:00:00.000Z")
const rowsOf = builder<LeadGenWorkbenchRow>({
    nowMs: NOW,
    installationId: null,
    leads: [],
    items: [],
    conversations: [],
    messages: [],
    isTestRun: () => false,
})
const messageOf = builder<LeadGenMessageRow>({
    conversation_id: "conversation-1",
    role: "user",
    body: "Hello",
    created_at: "2026-10-12T10:00:00.000Z",
})

describe("vnDayStart", () => {
    it.each([
        ["2026-10-11T16:59:59.999Z", "2026-10-10T17:00:00.000Z"],
        ["2026-10-11T17:00:00.000Z", "2026-10-11T17:00:00.000Z"],
        ["2026-10-12T16:59:59.999Z", "2026-10-11T17:00:00.000Z"],
    ])("reports Vietnamese midnight for %s", (now, expected) => {
        expect(vnDayStart(Date.parse(now))).toBe(Date.parse(expected))
    })
})

describe("median", () => {
    it("returns null without reply samples", () => {
        expect(median([])).toBeNull()
    })

    it("sorts odd samples numerically without changing the caller's array", () => {
        const samples = [100, 2, 10]

        expect(median(samples)).toBe(10)
        expect(samples).toEqual([100, 2, 10])
    })

    it("averages the middle two samples in an even set", () => {
        expect(median([20, 2, 8, 4])).toBe(6)
    })

    it("handles missing samples in sparse arrays", () => {
        expect(median(new Array<number>(1))).toBeNull()
        expect(median(new Array<number>(2))).toBe(0)
        expect(median([10, ...new Array<number>(1)])).toBe(5)
    })
})

describe("conversationFacts", () => {
    it("returns no evidence when there are no attached conversations", () => {
        expect(conversationFacts(rowsOf({ messages: [messageOf({ conversation_id: "unattached" })] }))).toEqual({
            last: new Map(),
            replyMinutes: [],
        })
    })

    it("ignores system messages and measures the first reply after the first user message", () => {
        const facts = conversationFacts(
            rowsOf({
                conversations: [{ id: "conversation-1", lead_id: "lead-1" }],
                messages: [
                    messageOf({ role: "agent", created_at: "2026-10-12T09:00:00.000Z" }),
                    messageOf(),
                    messageOf({ role: "agent", created_at: "2026-10-12T10:00:00.000Z" }),
                    messageOf({
                        role: "agent",
                        body: "  Thanks\n for   asking.  ",
                        created_at: "2026-10-12T10:05:30.000Z",
                    }),
                    messageOf({ role: "system", body: "Internal note", created_at: "2026-10-12T10:06:00.000Z" }),
                ],
            }),
        )

        expect(facts).toEqual({
            last: new Map([["lead-1", { text: "Thanks for asking.", at: "2026-10-12T10:05:30.000Z" }]]),
            replyMinutes: [5.5],
        })
    })

    it("keeps the latest conversation preview for each lead and clips long text", () => {
        const facts = conversationFacts(
            rowsOf({
                conversations: [
                    { id: "conversation-1", lead_id: "lead-1" },
                    { id: "older", lead_id: "lead-1" },
                    { id: "same-time", lead_id: "lead-1" },
                    { id: "newer", lead_id: "lead-1" },
                ],
                messages: [
                    messageOf(),
                    messageOf({ conversation_id: "older", body: "Old", created_at: "2026-10-11T10:00:00.000Z" }),
                    messageOf({ conversation_id: "same-time", body: "Tied" }),
                    messageOf({
                        conversation_id: "newer",
                        body: "x".repeat(150),
                        created_at: "2026-10-12T11:00:00.000Z",
                    }),
                ],
            }),
        )

        expect(facts).toEqual({
            last: new Map([["lead-1", { text: `${"x".repeat(139)}…`, at: "2026-10-12T11:00:00.000Z" }]]),
            replyMinutes: [],
        })
    })

    it("omits previews for unlinked leads and conversations containing only system messages", () => {
        const facts = conversationFacts(
            rowsOf({
                conversations: [
                    { id: "conversation-1", lead_id: null },
                    { id: "system-only", lead_id: "lead-1" },
                    { id: "agent-only", lead_id: "lead-2" },
                ],
                messages: [
                    messageOf({ role: "agent" }),
                    messageOf({ conversation_id: "system-only", role: "system" }),
                    messageOf({ conversation_id: "agent-only", role: "agent", body: "Welcome" }),
                ],
            }),
        )

        expect(facts).toEqual({
            last: new Map([["lead-2", { text: "Welcome", at: "2026-10-12T10:00:00.000Z" }]]),
            replyMinutes: [],
        })
    })

    it("includes first messages exactly thirty days old and excludes older reply samples", () => {
        const facts = conversationFacts(
            rowsOf({
                conversations: [
                    { id: "boundary", lead_id: "lead-1" },
                    { id: "older", lead_id: "lead-2" },
                ],
                messages: [
                    messageOf({ conversation_id: "boundary", created_at: "2026-09-12T12:00:00.000Z" }),
                    messageOf({
                        conversation_id: "boundary",
                        role: "agent",
                        body: "Boundary reply",
                        created_at: "2026-09-12T12:02:00.000Z",
                    }),
                    messageOf({ conversation_id: "older", created_at: "2026-09-12T11:59:59.999Z" }),
                    messageOf({
                        conversation_id: "older",
                        role: "agent",
                        body: "Old reply",
                        created_at: "2026-09-12T12:02:00.000Z",
                    }),
                ],
            }),
        )

        expect(facts).toEqual({
            last: new Map([
                ["lead-1", { text: "Boundary reply", at: "2026-09-12T12:02:00.000Z" }],
                ["lead-2", { text: "Old reply", at: "2026-09-12T12:02:00.000Z" }],
            ]),
            replyMinutes: [2],
        })
    })
})
