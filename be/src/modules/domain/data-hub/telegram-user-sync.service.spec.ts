import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { DataSourcesError, DataSourcesErrorCode } from "@modules/integrations/data-sources"
import { TELEGRAM_REVOKED_MESSAGE, TELEGRAM_USER } from "@modules/integrations/telegram-user"
import type { TelegramRawMessage, TelegramUserClient } from "@modules/integrations/telegram-user"
import { CLOCK } from "@modules/platform/clock"
import type { DataSyncContext } from "./data-hub.contracts"
import { TELEGRAM_WIZARD_TEXT } from "./messages/telegram-user-wizard.messages"
import { TelegramUserSyncService } from "./telegram-user-sync.service"
import type { TelegramConfig } from "./telegram-user-wizard.contracts"

const config: TelegramConfig = {
    chats: [
        { id: "100", title: "Support", kind: "group" },
        { id: "-200", title: "Announcements", kind: "channel" },
    ],
    sinceDays: 7,
}

const message: TelegramRawMessage = {
    id: 42,
    date: 1_791_936_000,
    text: "A customer needs help",
    senderName: "Alice",
    replyToId: null,
    hasMedia: false,
}

const savedMeta = { config: JSON.stringify(config), "cursor:100": "41" }

const build = async (meta: Readonly<Record<string, string>> = savedMeta, credential = '{"session":"test-session"}') => {
    const telegram = mock<TelegramUserClient>()
    const clock = new FakeClock("2026-10-14T00:00:00.000Z")
    const now = jest.spyOn(clock, "now")
    const context = mock<DataSyncContext>({
        connection: {
            id: "connection-1",
            workspaceId: "workspace-1",
            provider: "telegram_user",
            name: "Support account",
            status: "connected",
            lastError: null,
            meta,
            everyMinutes: 15,
            lastSyncAt: null,
        },
        credential,
    })
    context.isExpired.mockReturnValue(false)
    context.upsert.mockResolvedValue(1)
    telegram.readChats.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramUserSyncService,
            { provide: TELEGRAM_USER, useValue: telegram },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return { service: moduleRef.get(TelegramUserSyncService), telegram, now, context }
}

const EXPECTED_SYNC_RESULT = {
    rows: 5,
    meta: { "cursor:100": "43", "cursor:-200": "1" },
}

describe("TelegramUserSyncService", () => {
    it("reads picked chats with their cursors and writes exact message rows in order", async () => {
        const { service, telegram, context } = await build()
        telegram.readChats.mockResolvedValue([
            {
                chatId: "100",
                messages: [message, { ...message, id: 43, text: "", replyToId: 42, hasMedia: true }],
                maxId: 43,
                capped: false,
            },
            {
                chatId: "-200",
                messages: [{ ...message, id: 1, text: "New release", senderName: "Bob" }],
                maxId: 1,
                capped: false,
            },
        ])
        context.upsert.mockResolvedValueOnce(2).mockResolvedValueOnce(3)

        await expect(service.sync(context)).resolves.toEqual(EXPECTED_SYNC_RESULT)
        expect(service.provider).toBe("telegram_user")
        expect(telegram.readChats).toHaveBeenCalledWith({
            session: "test-session",
            chatIds: ["100", "-200"],
            cursors: new Map([
                ["100", 41],
                ["-200", 0],
            ]),
            sinceUnix: 1_791_331_200,
            perChatLimit: 200,
            isExpired: context.isExpired,
        })
        expect(context.upsert).toHaveBeenNthCalledWith(1, "message", [
            {
                externalId: "100:42",
                title: "A customer needs help",
                occurredAt: new Date("2026-10-14T00:00:00.000Z"),
                data: {
                    chatId: "100",
                    chatTitle: "Support",
                    senderName: "Alice",
                    text: "A customer needs help",
                    replyToId: null,
                    hasMedia: false,
                },
            },
            {
                externalId: "100:43",
                title: TELEGRAM_WIZARD_TEXT.attachment,
                occurredAt: new Date("2026-10-14T00:00:00.000Z"),
                data: {
                    chatId: "100",
                    chatTitle: "Support",
                    senderName: "Alice",
                    text: "",
                    replyToId: 42,
                    hasMedia: true,
                },
            },
        ])
        expect(context.upsert).toHaveBeenNthCalledWith(2, "message", [
            {
                externalId: "-200:1",
                title: "New release",
                occurredAt: new Date("2026-10-14T00:00:00.000Z"),
                data: {
                    chatId: "-200",
                    chatTitle: "Announcements",
                    senderName: "Bob",
                    text: "New release",
                    replyToId: null,
                    hasMedia: false,
                },
            },
        ])
    })
})

describe("TelegramUserSyncService", () => {
    it.each(["{}", "broken", '{"session":""}', '{"session":1}'])(
        "rejects a credential without a usable session: %s",
        async (credential) => {
            const { service, telegram, now, context } = await build(savedMeta, credential)

            await expect(service.sync(context)).rejects.toMatchObject({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: TELEGRAM_REVOKED_MESSAGE },
            })
            expect(telegram.readChats).not.toHaveBeenCalled()
            expect(now).not.toHaveBeenCalled()
            expect(context.upsert).not.toHaveBeenCalled()
        },
    )

    it.each<Readonly<Record<string, string>>>([{}, { config: "broken" }, { config: "null" }])(
        "returns the setup note when configuration is absent or malformed: %j",
        async (meta) => {
            const { service, telegram, now, context } = await build(meta)

            await expect(service.sync(context)).resolves.toEqual({ rows: 0, note: TELEGRAM_WIZARD_TEXT.noChatsPicked })
            expect(telegram.readChats).not.toHaveBeenCalled()
            expect(now).not.toHaveBeenCalled()
            expect(context.upsert).not.toHaveBeenCalled()
        },
    )

    it("returns the setup note when the configuration picks no chats", async () => {
        const { service, telegram, now, context } = await build({ config: '{"chats":[],"sinceDays":7}' })

        await expect(service.sync(context)).resolves.toEqual({ rows: 0, note: TELEGRAM_WIZARD_TEXT.noChatsPicked })
        expect(telegram.readChats).not.toHaveBeenCalled()
        expect(now).not.toHaveBeenCalled()
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it("returns no rows or metadata when Telegram reads no chats", async () => {
        const { service, telegram, context } = await build()

        await expect(service.sync(context)).resolves.toEqual({ rows: 0 })
        expect(telegram.readChats).toHaveBeenCalledTimes(1)
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it("ignores messages, cursor advances and caps from chats that were not picked", async () => {
        const { service, telegram, context } = await build()
        telegram.readChats.mockResolvedValue([{ chatId: "999", messages: [message], maxId: 500, capped: true }])

        await expect(service.sync(context)).resolves.toEqual({ rows: 0 })
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it("advances a cursor for an empty chat read without writing rows", async () => {
        const { service, telegram, context } = await build()
        telegram.readChats.mockResolvedValue([{ chatId: "100", messages: [], maxId: 45, capped: false }])

        await expect(service.sync(context)).resolves.toEqual({ rows: 0, meta: { "cursor:100": "45" } })
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it.each([41, 40])("does not replace a saved cursor with message id %i", async (maxId) => {
        const { service, telegram, context } = await build()
        telegram.readChats.mockResolvedValue([{ chatId: "100", messages: [], maxId, capped: false }])

        await expect(service.sync(context)).resolves.toEqual({ rows: 0 })
        expect(context.upsert).not.toHaveBeenCalled()
    })
})

describe("TelegramUserSyncService", () => {
    it("reports the exact number of capped chats even when they have no message rows", async () => {
        const { service, telegram, context } = await build()
        telegram.readChats.mockResolvedValue([
            { chatId: "100", messages: [], maxId: 41, capped: true },
            { chatId: "-200", messages: [], maxId: 0, capped: true },
        ])

        await expect(service.sync(context)).resolves.toEqual({ rows: 0, note: TELEGRAM_WIZARD_TEXT.olderLeft(2) })
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it("returns both the cap note and advancing cursor metadata", async () => {
        const { service, telegram, context } = await build()
        telegram.readChats.mockResolvedValue([{ chatId: "100", messages: [message], maxId: 42, capped: true }])

        await expect(service.sync(context)).resolves.toEqual({
            rows: 1,
            note: TELEGRAM_WIZARD_TEXT.olderLeft(1),
            meta: { "cursor:100": "42" },
        })
    })

    it("reads the configured thirty-day window and forwards an already expired budget", async () => {
        const { service, telegram, context } = await build({ config: JSON.stringify({ ...config, sinceDays: 30 }) })
        context.isExpired.mockReturnValue(true)

        await expect(service.sync(context)).resolves.toEqual({ rows: 0 })
        expect(telegram.readChats).toHaveBeenCalledWith({
            session: "test-session",
            chatIds: ["100", "-200"],
            cursors: new Map([
                ["100", 0],
                ["-200", 0],
            ]),
            sinceUnix: 1_789_344_000,
            perChatLimit: 200,
            isExpired: context.isExpired,
        })
        expect(context.isExpired).not.toHaveBeenCalled()
    })

    it("uses zero as the defensive cursor baseline when a lookup has no value", async () => {
        const { service, telegram, context } = await build()
        telegram.readChats.mockImplementation((request) => {
            expect(request.cursors.get("100")).toBe(41)
            if (request.cursors instanceof Map) request.cursors.delete("100")
            expect(request.cursors.has("100")).toBe(false)
            return Promise.resolve([{ chatId: "100", messages: [], maxId: 1, capped: false }])
        })

        await expect(service.sync(context)).resolves.toEqual({ rows: 0, meta: { "cursor:100": "1" } })
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it.each([DataSourcesErrorCode.Rejected, DataSourcesErrorCode.Unavailable])(
        "propagates a Telegram domain failure with code %s",
        async (code) => {
            const { service, telegram, context } = await build()
            const cause = new DataSourcesError({ code, params: { detail: "Telegram read failed" } })
            telegram.readChats.mockRejectedValue(cause)

            await expect(service.sync(context)).rejects.toBe(cause)
            expect(context.upsert).not.toHaveBeenCalled()
        },
    )
})

describe("TelegramUserSyncService", () => {
    it("propagates an unexpected Telegram read failure without writing messages", async () => {
        const { service, telegram, context } = await build()
        const cause = new Error("unexpected Telegram read failure")
        telegram.readChats.mockRejectedValue(cause)

        await expect(service.sync(context)).rejects.toBe(cause)
        expect(context.upsert).not.toHaveBeenCalled()
    })
})

describe("TelegramUserSyncService", () => {
    it("propagates a write failure before processing the next chat", async () => {
        const { service, telegram, context } = await build()
        const cause = new Error("message write failed")
        telegram.readChats.mockResolvedValue([
            { chatId: "100", messages: [message], maxId: 42, capped: true },
            { chatId: "-200", messages: [message], maxId: 42, capped: true },
        ])
        context.upsert.mockRejectedValue(cause)

        await expect(service.sync(context)).rejects.toBe(cause)
        expect(context.upsert).toHaveBeenCalledTimes(1)
    })
})
