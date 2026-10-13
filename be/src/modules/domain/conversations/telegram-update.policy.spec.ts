import { readTelegramUpdate } from "./telegram-update.policy"

const PHOTO = "[photo]"

const update = (message: Record<string, unknown>, updateId: unknown = 77) =>
    Buffer.from(JSON.stringify({ update_id: updateId, message }))

const text = (extra: Record<string, unknown> = {}) => ({
    message_id: 9,
    chat: { id: 555 },
    text: " Hello ",
    from: { first_name: "Minh", last_name: "Tran", username: "minh" },
    ...extra,
})

const read = (raw?: Buffer) => readTelegramUpdate(PHOTO, raw)

describe("readTelegramUpdate", () => {
    it("reads a text message with the chat, the ids and the customer name", () => {
        expect(read(update(text()))).toEqual({
            kind: "ok",
            value: { updateId: 77, chatId: "555", messageId: 9, text: "Hello", visitor: "Minh Tran", isStart: false },
        })
    })

    it("names the customer by the @username, then by the channel, when Telegram gives no name", () => {
        expect(read(update(text({ from: { username: "minh" } })))).toMatchObject({ value: { visitor: "@minh" } })
        expect(read(update(text({ from: {} })))).toMatchObject({ value: { visitor: "Telegram" } })
        expect(read(update(text({ from: undefined })))).toMatchObject({ value: { visitor: "Telegram" } })
    })

    it("recognizes /start, with or without a payload, as a new visit", () => {
        expect(read(update(text({ text: "/start" })))).toMatchObject({ value: { isStart: true } })
        expect(read(update(text({ text: "/start promo" })))).toMatchObject({ value: { isStart: true } })
        expect(read(update(text({ text: "start" })))).toMatchObject({ value: { isStart: false } })
    })

    it("reads a photo as the label with its caption, and as the label alone without one", () => {
        const photo = { text: undefined, photo: [{}], caption: " Transfer done " }

        expect(read(update(text(photo)))).toMatchObject({ value: { text: "[photo] Transfer done" } })
        expect(read(update(text({ ...photo, caption: undefined })))).toMatchObject({ value: { text: "[photo]" } })
    })

    it("refuses anything the chat does not answer", () => {
        const refusals = [
            read(),
            read(Buffer.from("not json")),
            read(Buffer.from(JSON.stringify({ update_id: 1, edited_message: {} }))),
            read(Buffer.from(JSON.stringify({ message: text() }))),
            read(update(text({ message_id: undefined }))),
            read(update(text({ chat: {} }))),
            read(update(text({ text: undefined }))),
            read(update(text({ text: undefined, photo: [] }))),
            read(update(text({ text: undefined, photo: "x" }))),
        ]

        for (const refusal of refusals) expect(refusal.kind).toBe("refused")
    })
})
