import { Test } from "@nestjs/testing"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    TELEGRAM_MESSAGE_WEBHOOK as realWebhook,
    telegramLineOf,
    type TelegramUpdateRow,
} from "./telegram-message.trigger"

const SUBJECT = Symbol("telegram-message.trigger")
type Subject = { webhook: typeof realWebhook }

const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { webhook: realWebhook } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const message = (patch: Record<string, unknown> = {}): Readonly<Record<string, unknown>> => ({
    message_id: 7,
    date: 1_762_217_400,
    chat: { id: 555 },
    from: { id: 555, first_name: "Lan", last_name: "Nguyen", username: "lan" },
    text: " Xin chao ",
    ...patch,
})

const ORIGIN = { connectionId: "conn-1" }

const row = (patch: Record<string, unknown> = {}, update: Record<string, unknown> = {}): TelegramUpdateRow => ({
    updateId: "100",
    raw: { update_id: 100, message: message(patch), ...update },
})

describe("the Telegram message trigger", () => {
    it("declares the telegram message verb received by webhook, keyed by the person on the bot", async () => {
        const { webhook } = await buildSubject()

        expect([webhook.provider, webhook.name, webhook.verb, webhook.via, webhook.key]).toEqual([
            PROVIDER.telegram,
            "message.received",
            TRIGGER.telegramMessageReceived,
            "webhook",
            { by: "subject" },
        ])
        expect(webhook.settle).toEqual({ windowMs: 6000, maxWaitMs: 20_000 })
    })

    it("translates a text into one event: the update id, the person by their chat with the name the update gives, the line under its old key", async () => {
        const { webhook } = await buildSubject()

        expect(webhook.translate(row(), ORIGIN)).toEqual({
            id: "100",
            subject: { channel: "telegram", id: "555", name: "Lan Nguyen" },
            data: {
                messageKey: "tg:conn-1:555:7",
                text: "Xin chao",
                at: new Date(1_762_217_400_000).toISOString(),
                attachments: [],
            },
        })
    })

    it("is pure (same row, same event) and its data fits the declared schema", async () => {
        const { webhook } = await buildSubject()
        const one = row()

        const first = webhook.translate(one, ORIGIN)
        expect(webhook.translate(one, ORIGIN)).toEqual(first)
        expect(webhook.data.safeParse(first?.data).success).toBe(true)
        expect(webhook.raw.safeParse(one).success).toBe(true)
    })

    it("keys the line by the bot's account: the same update on another bot is another line key", async () => {
        const { webhook } = await buildSubject()

        expect(webhook.translate(row(), { connectionId: "conn-2" })?.data.messageKey).toBe("tg:conn-2:555:7")
    })

    it("reads /start as plain text: no start flag, the words are the message", async () => {
        const { webhook } = await buildSubject()

        const start = webhook.translate(row({ text: "/start" }), ORIGIN)
        expect(start?.data.text).toBe("/start")
        expect(Object.keys(start?.data ?? {})).not.toContain("isStart")
    })

    it("names the person by @username when no name is given, and by nothing when the update gives neither", async () => {
        const { webhook } = await buildSubject()

        expect(webhook.translate(row({ from: { id: 555, username: "lan" } }), ORIGIN)?.subject).toEqual({
            channel: "telegram",
            id: "555",
            name: "@lan",
        })
        expect(webhook.translate(row({ from: { id: 555 } }), ORIGIN)?.subject).toEqual({
            channel: "telegram",
            id: "555",
        })
    })

    it("reads a photo with no text as the photo label and its caption, the largest size as the one picture", async () => {
        const { webhook } = await buildSubject()
        const photo = row({
            text: undefined,
            caption: " ck roi ",
            photo: [
                { file_id: "small", width: 90, height: 90, file_size: 1000 },
                { file_id: "big", width: 800, height: 600, file_size: 90_000 },
            ],
        })

        expect(webhook.translate(photo, ORIGIN)?.data).toMatchObject({
            text: "[Kh\u00e1ch g\u1eedi m\u1ed9t \u1ea3nh] ck roi",
            attachments: [{ kind: "image", fileId: "big", name: "", size: 90_000 }],
        })
    })

    it("keeps a PDF or an image sent as a file and drops any other document", async () => {
        const { webhook } = await buildSubject()

        expect(
            webhook.translate(
                row({ text: undefined, document: { file_id: "d1", mime_type: "application/pdf", file_name: "a.pdf" } }),
                ORIGIN,
            )?.data.attachments,
        ).toEqual([{ kind: "file", fileId: "d1", name: "a.pdf", size: null }])
        expect(
            webhook.translate(
                row({ text: undefined, document: { file_id: "d2", mime_type: "application/zip" } }),
                ORIGIN,
            ),
        ).toBeNull()
    })

    it("drops what the chat does not answer: no message, an edited message, no chat, no words", async () => {
        const { webhook } = await buildSubject()

        const dropped: ReadonlyArray<TelegramUpdateRow> = [
            { updateId: "100", raw: { update_id: 100, edited_message: message() } },
            row({ chat: undefined }),
            row({ message_id: undefined }),
            row({ text: "" }),
            { updateId: "x", raw: { message: message() } },
        ]

        for (const one of dropped) expect(webhook.translate(one, ORIGIN)).toBeNull()
    })
})

describe("TELEGRAM_MESSAGE_WEBHOOK: the person's line (owner ruling R26)", () => {
    it("gives the engine the message's line: its key, its words, the channel's time", () => {
        expect(
            telegramLineOf({
                messageKey: "tg:conn-1:7:9",
                text: "Shop c\u00f2n hoa kh\u00f4ng?",
                at: "2026-11-14T02:00:00.000Z",
                attachments: [],
            }),
        ).toEqual({
            key: "tg:conn-1:7:9",
            text: "Shop c\u00f2n hoa kh\u00f4ng?",
            at: "2026-11-14T02:00:00.000Z",
        })
        expect(realWebhook.line).toBe(telegramLineOf)
    })

    it("gives no line for the release door's resume (no key)", () => {
        expect(telegramLineOf({ messageKey: "", text: "", at: null, attachments: [], resume: "held" })).toBeNull()
    })
})
