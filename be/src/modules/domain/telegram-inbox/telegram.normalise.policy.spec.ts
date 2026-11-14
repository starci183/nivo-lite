import { Test } from "@nestjs/testing"
import { schemaOf } from "@modules/domain/account-data"
import { TELEGRAM_DATA_TYPES, telegramMessage, telegramUpdate, telegramUser } from "./telegram.data-types"
import {
    telegramBodyOf as realTelegramBodyOf,
    telegramMessageRowsOf as realTelegramMessageRowsOf,
    telegramRawOf as realTelegramRawOf,
    telegramSenderOf as realTelegramSenderOf,
    telegramUpdateRowsOf as realTelegramUpdateRowsOf,
} from "./telegram.normalise.policy"

const SUBJECT = Symbol("telegram.normalise.policy")
type Subject = {
    telegramBodyOf: typeof realTelegramBodyOf
    telegramMessageRowsOf: typeof realTelegramMessageRowsOf
    telegramRawOf: typeof realTelegramRawOf
    telegramSenderOf: typeof realTelegramSenderOf
    telegramUpdateRowsOf: typeof realTelegramUpdateRowsOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    telegramBodyOf: realTelegramBodyOf,
                    telegramMessageRowsOf: realTelegramMessageRowsOf,
                    telegramRawOf: realTelegramRawOf,
                    telegramSenderOf: realTelegramSenderOf,
                    telegramUpdateRowsOf: realTelegramUpdateRowsOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NOW = new Date("2026-11-12T08:00:00.000Z")

/** A real-shaped Telegram update of a customer message. */
const update = {
    update_id: 771_204_133,
    message: {
        message_id: 9,
        date: 1_762_850_000,
        chat: { id: 555, type: "private", first_name: "Minh" },
        text: "Hi",
        from: { id: 42, is_bot: false, username: "@Minh_N", first_name: "Minh", last_name: "N", language_code: "vi" },
    },
}
const inbound = {
    updateId: 771_204_133,
    chatId: "555",
    messageId: 9,
    text: "Hi",
    visitor: "Minh N",
    isStart: false,
    attachments: [],
    sentAt: 1_762_850_000_000,
}

/** The declaration of a row's type. */
const declarationOf = (type: string) => TELEGRAM_DATA_TYPES.find((def) => def.name === type)

describe("Telegram data types", () => {
    it("declares the update, the message and the person of a Telegram connection", () => {
        expect(TELEGRAM_DATA_TYPES.map((def) => [def.name, def.write, def.retention])).toEqual([
            ["telegram.update", "append", { days: 30 }],
            ["telegram.message", "append", "keep"],
            ["telegram.user", "overwrite", "keep"],
        ])
        expect(telegramUpdate.wakes).toBe(true)
        expect(telegramMessage.key).toEqual(["chatId", "messageId"])
        expect(telegramUser.indexes).toEqual([{ name: "username", on: ["username"] }])
        expect(TELEGRAM_DATA_TYPES.every((def) => def.provider === "telegram" && (def.secretFields ?? []).includes("bot_token"))).toBe(true)
    })
})

describe("telegramUpdateRowsOf", () => {
    it("keeps the body untouched in raw, keyed by the exact update_id, and the row fits its declaration", async () => {
        const subject = await buildSubject()
        const rows = subject.telegramUpdateRowsOf(Buffer.from(JSON.stringify(update)))

        expect(rows).toEqual([{ type: "telegram.update", value: { updateId: "771204133", raw: update } }])
        expect(rows.every((row) => schemaOf(telegramUpdate).safeParse(row.value).success)).toBe(true)
    })

    it("writes nothing for a body that names no update id", async () => {
        const subject = await buildSubject()

        expect(subject.telegramUpdateRowsOf(Buffer.from("{}"))).toEqual([])
        expect(subject.telegramUpdateRowsOf(Buffer.from("not json"))).toEqual([])
    })
})

describe("telegramRawOf and telegramBodyOf", () => {
    it("keeps a JSON object as it is and nothing of any other body, and reads a stored object back as its JSON", async () => {
        const subject = await buildSubject()

        expect(subject.telegramRawOf(Buffer.from(JSON.stringify(update)))).toEqual(update)
        expect(subject.telegramRawOf(Buffer.from("[1]"))).toBeNull()
        expect(subject.telegramRawOf(Buffer.from("plain"))).toBeNull()
        expect(subject.telegramBodyOf(update).toString("utf8")).toBe(JSON.stringify(update))
        expect(subject.telegramBodyOf("text").toString("utf8")).toBe("")
    })
})

describe("telegramSenderOf", () => {
    it("reads the sender's exact fields, the username lower-case without the @", async () => {
        const subject = await buildSubject()

        expect(subject.telegramSenderOf(update)).toEqual({ userId: "42", username: "minh_n", firstName: "Minh", lastName: "N" })
    })

    it("names nobody for an update that is no message or a message with no sender", async () => {
        const subject = await buildSubject()

        expect(subject.telegramSenderOf({ channel_post: { from: { id: 1 } } })).toBeNull()
        expect(subject.telegramSenderOf({ message: { text: "hi" } })).toBeNull()
        expect(subject.telegramSenderOf(null)).toBeNull()
    })
})

describe("telegramMessageRowsOf", () => {
    it("keeps the message by <chat id>:<message_id> and the person by their user id; both fit their declarations", async () => {
        const subject = await buildSubject()
        const rows = subject.telegramMessageRowsOf(update, inbound, NOW)
        const at = new Date(1_762_850_000_000).toISOString()

        expect(rows).toEqual([
            {
                type: "telegram.message",
                value: { chatId: "555", messageId: "9", userId: "42", username: "minh_n", direction: "in", text: "Hi", at },
            },
            { type: "telegram.user", value: { userId: "42", username: "minh_n", firstName: "Minh", lastName: "N", chatId: "555" } },
        ])
        rows.forEach((row) => {
            const def = declarationOf(row.type)
            expect(def === undefined ? false : schemaOf(def).safeParse(row.value).success).toBe(true)
        })
    })

    it("leaves out what the person does not have and dates a message without time by now", async () => {
        const subject = await buildSubject()
        const bare = { update_id: 1, message: { message_id: 9, chat: { id: 555 }, from: { id: 42 } } }
        const rows = subject.telegramMessageRowsOf(bare, { ...inbound, sentAt: null }, NOW)

        expect(rows).toEqual([
            {
                type: "telegram.message",
                value: { chatId: "555", messageId: "9", userId: "42", direction: "in", text: "Hi", at: NOW.toISOString() },
            },
            { type: "telegram.user", value: { userId: "42", chatId: "555" } },
        ])
    })

    it("keeps nothing for a message with no sender", async () => {
        const subject = await buildSubject()

        expect(subject.telegramMessageRowsOf({ message: { text: "hi" } }, inbound, NOW)).toEqual([])
    })
})
