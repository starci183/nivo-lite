import { Test } from "@nestjs/testing"
import { maskedChatOf, telegramEventsOf } from "./telegram-page.policy"

const SUBJECT = Symbol("telegram-page.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { maskedChatOf, telegramEventsOf } }],
    }).compile()
    return moduleRef.get<{ maskedChatOf: typeof maskedChatOf; telegramEventsOf: typeof telegramEventsOf }>(SUBJECT)
}

const WHO = "6201…118"

const row = (extra: Record<string, string | null> = {}) => ({
    id: "m-1",
    role: "user",
    body: "secret words",
    created_at: "2026-10-28T09:00:00.000Z",
    delivery_status: null,
    delivery_error: null,
    visitor_name: WHO,
    ...extra,
})

describe("maskedChatOf", () => {
    it.each([
        ["6201234118", WHO],
        ["12345678", "1234…678"],
        ["1234567", ""],
        ["", ""],
        [null, ""],
    ])("shows %j as %j", async (id, shown) => {
        const subject = await build()

        expect(subject.maskedChatOf(id)).toBe(shown)
    })
})

describe("telegramEventsOf", () => {
    it("lists customer messages, sent replies and failed replies newest first, with no text", async () => {
        const subject = await build()

        const events = subject.telegramEventsOf([
            row(),
            row({ id: "m-2", role: "agent", delivery_status: "sent", created_at: "2026-10-28T09:10:00.000Z" }),
            row({
                id: "m-3",
                role: "agent",
                delivery_status: "failed",
                delivery_error: "telegram_blocked",
                created_at: "2026-10-28T09:20:00.000Z",
                visitor_name: null,
            }),
            row({
                id: "m-4",
                role: "agent",
                delivery_status: "failed",
                created_at: "2026-10-28T09:05:00.000Z",
            }),
        ])

        expect(events.map((event) => [event.id, event.kind, event.outcome, event.reason, event.who])).toEqual([
            ["m-3", "agent_reply", "not_sent", "telegram_blocked", ""],
            ["m-2", "agent_reply", "sent", null, WHO],
            ["m-4", "agent_reply", "not_sent", "delivery_failed", WHO],
            ["m-1", "user_message", "received", null, WHO],
        ])
        expect(JSON.stringify(events)).not.toContain("secret words")
    })

    it("keeps the newest forty", async () => {
        const subject = await build()
        const rows = Array.from({ length: 45 }, (_, at) =>
            row({ id: `m-${at}`, created_at: new Date(Date.UTC(2026, 9, 28, 0, at)).toISOString() }),
        )

        const events = subject.telegramEventsOf(rows)

        expect(events).toHaveLength(40)
        expect(events[0]?.id).toBe("m-44")
    })
})
