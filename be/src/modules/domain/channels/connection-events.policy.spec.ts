import { Test } from "@nestjs/testing"
import { messageRowsOf } from "./connection-events.policy"
import type { FeedLine } from "./connection-events.policy"

const SUBJECT = Symbol("connection-events.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { messageRowsOf } }],
    }).compile()
    return moduleRef.get<{ messageRowsOf: typeof messageRowsOf }>(SUBJECT)
}

const line = (extra: Partial<FeedLine> = {}): FeedLine => ({
    id: "m-1",
    conversationId: "k-1",
    role: "user",
    body: "Hello",
    createdAt: "2026-10-28T09:00:00.000Z",
    deliveryStatus: null,
    deliveryError: null,
    ...extra,
})

describe("messageRowsOf", () => {
    it("carries the message and the name its conversation has", async () => {
        const subject = await build()

        expect(
            subject.messageRowsOf(
                [line(), line({ id: "m-2", role: "agent", deliveryStatus: "failed", deliveryError: "x" })],
                [{ id: "k-1", externalId: "9", visitorName: "An" }],
            ),
        ).toEqual([
            {
                id: "m-1",
                role: "user",
                body: "Hello",
                created_at: "2026-10-28T09:00:00.000Z",
                delivery_status: null,
                delivery_error: null,
                visitor_name: "An",
            },
            {
                id: "m-2",
                role: "agent",
                body: "Hello",
                created_at: "2026-10-28T09:00:00.000Z",
                delivery_status: "failed",
                delivery_error: "x",
                visitor_name: "An",
            },
        ])
    })

    it("leaves the name empty when the conversation is not known", async () => {
        const subject = await build()

        expect(subject.messageRowsOf([line({ conversationId: "k-9" })], [])[0]?.visitor_name).toBeNull()
    })
})
