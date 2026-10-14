import type { TelegramRawMessage } from "@modules/integrations/telegram-user"
import { TELEGRAM_WIZARD_TEXT } from "./messages/telegram-user-wizard.messages"
import {
    accountLabel,
    cleanChats,
    cursorKey,
    mapMessage,
    maskPhone,
    MAX_CHATS,
    MAX_PER_CHAT_PER_RUN,
    normalizePhone,
    parseConfig,
    readCursor,
    SCHEDULE_CHOICES,
    serializeConfig,
    sinceUnix,
    summaryOf,
    toSinceDays,
} from "./telegram-user-config.policy"
import type { PickedChat } from "./telegram-user-wizard.contracts"

const chat: PickedChat = { id: "-123", title: "Project", kind: "group" }
const messageOf = (overrides: Partial<TelegramRawMessage> = {}): TelegramRawMessage => ({
    id: 42,
    date: 1_700_000_000,
    text: "Hello",
    senderName: "Sender",
    replyToId: 12,
    hasMedia: false,
    ...overrides,
})

describe("Telegram configuration limits", () => {
    it("offers manual, quarter-hour and hourly schedules with bounded reads", () => {
        expect(MAX_CHATS).toBe(50)
        expect(MAX_PER_CHAT_PER_RUN).toBe(200)
        expect(SCHEDULE_CHOICES).toEqual([null, 15, 60])
    })
})

describe("normalizePhone", () => {
    it.each([
        [" 0912 (345)-678. ", "+84912345678"],
        ["84912345678", "+84912345678"],
        ["841234567890", "+841234567890"],
        ["0049123456789", "+49123456789"],
        ["+1 (234) 567-8901", "+12345678901"],
        ["+12345678", "+12345678"],
        ["+123456789012345", "+123456789012345"],
    ])("normalizes %s to %s", (raw, expected) => {
        expect(normalizePhone(raw)).toBe(expected)
    })

    it.each([
        "",
        "no phone",
        "+12+3456789",
        "12345678901",
        "8412345678",
        "8412345678901",
        "00012345678",
        "+012345678",
        "+1234567",
        "+1234567890123456",
    ])("rejects an unsupported or invalid number (%s)", (raw) => {
        expect(normalizePhone(raw)).toBeNull()
    })
})

describe("accountLabel", () => {
    it("keeps only three phone digits and trims the name", () => {
        expect(maskPhone("+84 (912)-345.678")).toBe("\u2026678")
        expect(accountLabel("  Owner Name  ", "owner", "+84912345678")).toBe("Owner Name (@owner) \u2026678")
        expect(accountLabel("  ", null, "+84912345678")).toBe("Telegram \u2026678")
    })
})

describe("cleanChats", () => {
    it.each([undefined, null, {}, "chats", 42])("returns no chats for a non-array (%s)", (value) => {
        expect(cleanChats(value)).toEqual([])
    })

    it("skips malformed entries and duplicate ids, preserving the first valid title", () => {
        expect(
            cleanChats([
                null,
                42,
                ["123"],
                { id: 123 },
                { id: "" },
                { id: "chat-1" },
                { id: "123456789012345678901" },
                { id: "1", title: "User", kind: "user" },
                { id: "1", title: "Duplicate", kind: "channel" },
                { id: "-2", title: "Channel", kind: "channel" },
                { id: "3", title: "Group", kind: "group" },
                { id: "4", title: 99, kind: "unknown" },
                { id: "12345678901234567890", title: "t".repeat(121) },
            ]),
        ).toEqual([
            { id: "1", title: "User", kind: "user" },
            { id: "-2", title: "Channel", kind: "channel" },
            { id: "3", title: "Group", kind: "group" },
            { id: "4", title: "4", kind: "group" },
            { id: "12345678901234567890", title: "t".repeat(120), kind: "group" },
        ])
    })

    it("keeps the first fifty valid unique chats", () => {
        const chats = Array.from({ length: 51 }, (_unused, index) => ({
            id: String(index),
            title: `Chat ${index}`,
            kind: "group",
        }))

        expect(cleanChats(chats)).toEqual(chats.slice(0, 50))
    })
})

describe("parseConfig", () => {
    it.each([null, undefined, "", "{", "null", "[]", "1", "{}", '{"chats":{}}'])(
        "returns null for missing or broken configuration (%s)",
        (raw) => {
            expect(parseConfig(raw)).toBeNull()
        },
    )

    it("cleans saved chats and recognizes the thirty-day window", () => {
        expect(parseConfig(JSON.stringify({ chats: [chat, chat, { id: "nope" }], sinceDays: 30 }))).toEqual({
            chats: [chat],
            sinceDays: 30,
        })
        expect(parseConfig(JSON.stringify({ chats: [], sinceDays: 60 }))).toEqual({ chats: [], sinceDays: 7 })
        expect(parseConfig(JSON.stringify({ chats: [chat] }))).toEqual({ chats: [chat], sinceDays: 7 })
    })
})

describe("serializeConfig", () => {
    it("stores only fifty chats with titles capped at 120 characters", () => {
        const chats = Array.from({ length: 51 }, (_unused, index): PickedChat => ({
            id: String(index),
            title: "t".repeat(121),
            kind: "channel",
        }))
        const expected = Array.from({ length: 50 }, (_unused, index) => ({
            id: String(index),
            title: "t".repeat(120),
            kind: "channel",
        }))

        expect(serializeConfig({ chats, sinceDays: 30 })).toBe(JSON.stringify({ chats: expected, sinceDays: 30 }))
        expect(chats).toHaveLength(51)
        expect(chats[0]?.title).toHaveLength(121)
    })
})

describe("sync window and summary", () => {
    it("uses the owner-facing summary and chooses seven or thirty days", () => {
        expect(summaryOf(2)).toBe(TELEGRAM_WIZARD_TEXT.summary(2))
        expect(toSinceDays(30)).toBe(30)
        expect(toSinceDays(7)).toBe(7)
        expect(toSinceDays(60)).toBe(7)
    })

    it("converts the first sync window to whole Unix seconds", () => {
        expect(sinceUnix(7, 1_700_000_000_999)).toBe(1_699_395_200)
        expect(sinceUnix(30, 1_700_000_000_000)).toBe(1_697_408_000)
    })
})

describe("readCursor", () => {
    it("uses a cursor key per chat and reads positive integral ids", () => {
        expect(cursorKey("-123")).toBe("cursor:-123")
        expect(readCursor({ "cursor:-123": "42", "cursor:456": "99" }, "-123")).toBe(42)
    })

    it.each(["0", "-1", "1.5", "NaN", "Infinity", "", "bad"])("defaults an invalid cursor (%s) to zero", (value) => {
        expect(readCursor({ "cursor:-123": value }, "-123")).toBe(0)
    })

    it("defaults a missing cursor to zero", () => {
        expect(readCursor({}, "-123")).toBe(0)
    })
})

describe("mapMessage", () => {
    it("maps the chat, message id, timestamp and body into a hub row", () => {
        expect(mapMessage(chat, messageOf())).toEqual({
            externalId: "-123:42",
            title: "Hello",
            occurredAt: new Date("2023-11-14T22:13:20.000Z"),
            data: {
                chatId: "-123",
                chatTitle: "Project",
                senderName: "Sender",
                text: "Hello",
                replyToId: 12,
                hasMedia: false,
            },
        })
    })

    it("caps the text at 4000 characters and the title at 120", () => {
        expect(mapMessage(chat, messageOf({ text: "t".repeat(4001), hasMedia: true, replyToId: null }))).toEqual({
            externalId: "-123:42",
            title: "t".repeat(120),
            occurredAt: new Date("2023-11-14T22:13:20.000Z"),
            data: {
                chatId: "-123",
                chatTitle: "Project",
                senderName: "Sender",
                text: "t".repeat(4000),
                replyToId: null,
                hasMedia: true,
            },
        })
    })

    it("uses the attachment label only for an empty message with media", () => {
        expect(mapMessage(chat, messageOf({ text: "", hasMedia: true })).title).toBe(TELEGRAM_WIZARD_TEXT.attachment)
        expect(mapMessage(chat, messageOf({ text: "", hasMedia: false })).title).toBe("")
    })
})
