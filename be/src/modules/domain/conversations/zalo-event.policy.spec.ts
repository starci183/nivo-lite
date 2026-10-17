import { Test } from "@nestjs/testing"
import { readZaloEvent } from "./zalo-event.policy"

const SUBJECT = Symbol("zalo-event.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readZaloEvent } }],
    }).compile()
    return moduleRef.get<typeof import("./zalo-event.policy")>(SUBJECT)
}

const event = (patch: Record<string, unknown> = {}) =>
    Buffer.from(
        JSON.stringify({
            app_id: "app-1",
            event_name: "user_send_text",
            sender: { id: "user-1" },
            message: { msg_id: "m-1", text: " Hello " },
            ...patch,
        }),
    )

describe("readZaloEvent", () => {
    it("reads a customer text message with the app, the user and the message id", async () => {
        const subject = await buildSubject()

        expect(subject.readZaloEvent(event())).toEqual({
            kind: "ok",
            value: { appId: "app-1", userId: "user-1", messageId: "m-1", text: "Hello" },
        })
    })

    it("has an empty app id when the event names none", async () => {
        const subject = await buildSubject()

        expect(subject.readZaloEvent(event({ app_id: undefined }))).toMatchObject({ value: { appId: "" } })
    })

    it("refuses any other event and one that lacks the sender, the message id or the text", async () => {
        const subject = await buildSubject()

        const refusals = [
            subject.readZaloEvent(),
            subject.readZaloEvent(Buffer.from("[]")),
            subject.readZaloEvent(event({ event_name: "follow" })),
            subject.readZaloEvent(event({ sender: {} })),
            subject.readZaloEvent(event({ message: { text: "x" } })),
            subject.readZaloEvent(event({ message: { msg_id: "m-1" } })),
            subject.readZaloEvent(event({ message: { msg_id: "m-1", text: "   " } })),
        ]

        for (const refusal of refusals) expect(refusal.kind).toBe("refused")
    })
})
