import { readZaloEvent } from "./zalo-event.policy"

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
    it("reads a customer text message with the app, the user and the message id", () => {
        expect(readZaloEvent(event())).toEqual({
            kind: "ok",
            value: { appId: "app-1", userId: "user-1", messageId: "m-1", text: "Hello" },
        })
    })

    it("has an empty app id when the event names none", () => {
        expect(readZaloEvent(event({ app_id: undefined }))).toMatchObject({ value: { appId: "" } })
    })

    it("refuses any other event and one that lacks the sender, the message id or the text", () => {
        const refusals = [
            readZaloEvent(),
            readZaloEvent(Buffer.from("[]")),
            readZaloEvent(event({ event_name: "follow" })),
            readZaloEvent(event({ sender: {} })),
            readZaloEvent(event({ message: { text: "x" } })),
            readZaloEvent(event({ message: { msg_id: "m-1" } })),
            readZaloEvent(event({ message: { msg_id: "m-1", text: "   " } })),
        ]

        for (const refusal of refusals) expect(refusal.kind).toBe("refused")
    })
})
