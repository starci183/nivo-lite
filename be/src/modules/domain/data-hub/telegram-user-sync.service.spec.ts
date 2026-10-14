import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { DataSourcesErrorCode, TELEGRAM_REVOKED_MESSAGE, TELEGRAM_USER } from "@modules/integrations/data-sources"
import type { TelegramUserClient } from "@modules/integrations/data-sources"
import { CLOCK } from "@modules/platform/clock"
import type { DataConnection, DataSyncContext } from "./data-hub.contracts"
import { TELEGRAM_WIZARD_TEXT as TEXT } from "./messages/telegram-user-wizard.messages"
import { TelegramUserSyncService } from "./telegram-user-sync.service"

const NOW = "2026-10-14T12:00:00.000Z"
const chats = [
    { id: "-100", title: "Team", kind: "group" },
    { id: "42", title: "News", kind: "channel" },
]
const connection = builder<DataConnection>({
    id: "telegram-1",
    workspaceId: "workspace-1",
    provider: "telegram_user",
    name: "Personal Telegram",
    status: "connected",
    lastError: null,
    meta: { config: JSON.stringify({ chats, sinceDays: 30 }), "cursor:-100": "10" },
    everyMinutes: 15,
    lastSyncAt: null,
})
const build = async () => {
    const telegram = mock<TelegramUserClient>()
    const context = mock<DataSyncContext>({ connection: connection(), credential: '{"session":"saved-session"}' })
    context.upsert.mockImplementation((_entity, rows) => Promise.resolve(rows.length))
    telegram.readChats.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramUserSyncService,
            { provide: TELEGRAM_USER, useValue: telegram },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { service: moduleRef.get(TelegramUserSyncService), telegram, context }
}

describe("TelegramUserSyncService", () => {
    it("identifies the provider and rejects a missing session before reading chats", async () => {
        const { service, telegram, context } = await build()
        expect(service.provider).toBe("telegram_user")
        await expect(service.sync({ ...context, credential: "{}" })).rejects.toMatchObject({
            code: DataSourcesErrorCode.Rejected,
            params: { detail: TELEGRAM_REVOKED_MESSAGE },
        })
        expect(telegram.readChats).not.toHaveBeenCalled()
    })

    it.each(["", JSON.stringify({ chats: [], sinceDays: 7 })])(
        "returns the picker note for config %s",
        async (config) => {
            const { service, telegram, context } = await build()
            await expect(service.sync({ ...context, connection: connection({ meta: { config } }) })).resolves.toEqual({
                rows: 0,
                note: TEXT.noChatsPicked,
            })
            expect(telegram.readChats).not.toHaveBeenCalled()
            expect(context.upsert).not.toHaveBeenCalled()
        },
    )

    it("sends picked chats, stored cursors, the first window and expiration callback to Telegram", async () => {
        const { service, telegram, context } = await build()
        await expect(service.sync(context)).resolves.toEqual({ rows: 0 })
        expect(telegram.readChats).toHaveBeenCalledWith({
            session: "saved-session",
            chatIds: ["-100", "42"],
            cursors: new Map([
                ["-100", 10],
                ["42", 0],
            ]),
            sinceUnix: 1789387200,
            perChatLimit: 200,
            isExpired: context.isExpired,
        })
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it("stores mapped messages in read order and counts written rows and capped picked chats", async () => {
        const { service, telegram, context } = await build()
        const message = { id: 11, date: 123, text: "Hello", senderName: "Ada", replyToId: 3, hasMedia: false }
        telegram.readChats.mockResolvedValue([
            { chatId: "unknown", messages: [message], maxId: 100, capped: true },
            { chatId: "-100", messages: [message], maxId: 11, capped: true },
            { chatId: "42", messages: [{ ...message, id: 8, text: "News" }], maxId: 8, capped: true },
        ])
        context.upsert.mockResolvedValueOnce(2).mockResolvedValueOnce(3)
        await expect(service.sync(context)).resolves.toEqual({
            rows: 5,
            note: TEXT.olderLeft(2),
            meta: { "cursor:-100": "11", "cursor:42": "8" },
        })
        expect(context.upsert).toHaveBeenCalledTimes(2)
        expect(context.upsert).toHaveBeenNthCalledWith(1, "message", [
            {
                externalId: "-100:11",
                title: "Hello",
                occurredAt: new Date(123000),
                data: {
                    chatId: "-100",
                    chatTitle: "Team",
                    senderName: "Ada",
                    text: "Hello",
                    replyToId: 3,
                    hasMedia: false,
                },
            },
        ])
        expect(context.upsert).toHaveBeenNthCalledWith(2, "message", [
            {
                externalId: "42:8",
                title: "News",
                occurredAt: new Date(123000),
                data: {
                    chatId: "42",
                    chatTitle: "News",
                    senderName: "Ada",
                    text: "News",
                    replyToId: 3,
                    hasMedia: false,
                },
            },
        ])
    })

    it("advances service-message cursors without upserting and keeps cursors that did not advance", async () => {
        const { service, telegram, context } = await build()
        telegram.readChats.mockResolvedValue([
            { chatId: "-100", messages: [], maxId: 10, capped: false },
            { chatId: "42", messages: [], maxId: 3, capped: false },
        ])
        await expect(service.sync(context)).resolves.toEqual({ rows: 0, meta: { "cursor:42": "3" } })
        expect(context.upsert).not.toHaveBeenCalled()
        telegram.readChats.mockResolvedValue([{ chatId: "-100", messages: [], maxId: 9, capped: false }])
        await expect(service.sync(context)).resolves.toEqual({ rows: 0 })
    })

    it("compares against the initial cursor when shared metadata changes during upsert", async () => {
        const { service, telegram, context } = await build()
        const meta = { ...connection().meta }
        const message = { id: 11, date: 123, text: "Hello", senderName: "Ada", replyToId: 3, hasMedia: false }
        telegram.readChats.mockResolvedValue([{ chatId: "-100", messages: [message], maxId: 11, capped: false }])
        context.upsert.mockImplementation(() =>
            Promise.resolve().then(() => {
                meta["cursor:-100"] = "20"
                return 1
            }),
        )
        await expect(
            service.sync({
                connection: connection({ meta }),
                credential: context.credential,
                upsert: context.upsert,
                isExpired: context.isExpired,
            }),
        ).resolves.toEqual({
            rows: 1,
            meta: { "cursor:-100": "11" },
        })
        expect(meta["cursor:-100"]).toBe("20")
        expect(telegram.readChats).toHaveBeenCalledWith({
            session: "saved-session",
            chatIds: ["-100", "42"],
            cursors: new Map([
                ["-100", 10],
                ["42", 0],
            ]),
            sinceUnix: 1789387200,
            perChatLimit: 200,
            isExpired: context.isExpired,
        })
        expect(context.upsert).toHaveBeenCalledTimes(1)
        expect(context.upsert).toHaveBeenCalledWith("message", [
            {
                externalId: "-100:11",
                title: "Hello",
                occurredAt: new Date(123000),
                data: {
                    chatId: "-100",
                    chatTitle: "Team",
                    senderName: "Ada",
                    text: "Hello",
                    replyToId: 3,
                    hasMedia: false,
                },
            },
        ])
    })

    it("falls back to zero if the client removes a picked chat's cursor from the supplied Map", async () => {
        const { service, telegram, context } = await build()
        const message = { id: 9, date: 123, text: "Earlier", senderName: "Ada", replyToId: null, hasMedia: false }
        telegram.readChats.mockImplementation((options) => {
            expect(options).toEqual({
                session: "saved-session",
                chatIds: ["-100", "42"],
                cursors: new Map([
                    ["-100", 10],
                    ["42", 0],
                ]),
                sinceUnix: 1789387200,
                perChatLimit: 200,
                isExpired: context.isExpired,
            })
            if (options.cursors instanceof Map) expect(options.cursors.delete("-100")).toBe(true)
            return Promise.resolve([{ chatId: "-100", messages: [message], maxId: 9, capped: false }])
        })
        await expect(service.sync(context)).resolves.toEqual({ rows: 1, meta: { "cursor:-100": "9" } })
        expect(telegram.readChats).toHaveBeenCalledTimes(1)
        expect(telegram.readChats).toHaveBeenCalledWith({
            session: "saved-session",
            chatIds: ["-100", "42"],
            cursors: new Map([["42", 0]]),
            sinceUnix: 1789387200,
            perChatLimit: 200,
            isExpired: context.isExpired,
        })
        expect(context.upsert).toHaveBeenCalledTimes(1)
        expect(context.upsert).toHaveBeenCalledWith("message", [
            {
                externalId: "-100:9",
                title: "Earlier",
                occurredAt: new Date(123000),
                data: {
                    chatId: "-100",
                    chatTitle: "Team",
                    senderName: "Ada",
                    text: "Earlier",
                    replyToId: null,
                    hasMedia: false,
                },
            },
        ])
    })
})
