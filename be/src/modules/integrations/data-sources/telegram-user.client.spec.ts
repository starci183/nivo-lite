import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DATA_SOURCES_OPTIONS } from "./data-sources.decorators"
import type { DataSourcesOptions } from "./data-sources.options"
import { DataSourcesErrorCode } from "./errors/data-sources.error"
import { TELEGRAM_USER_TEXT } from "./messages/telegram-user.messages"
import { TelegramUserClient } from "./telegram-user.client"
import type { TelegramReadRequest } from "./telegram-user.contracts"
import { TelegramUserLogEvent } from "./telegram-user.log-events"

interface SavedSession {
    save: () => string
}

class MockTelegram {
    mode = "ok"
    authorized = true
    destroyError: Error | undefined = undefined
    connectError: unknown = undefined
    dialogs: Array<Record<string, unknown>> = []
    messages: Array<Record<string, unknown>> = []
    windows: Array<Record<string, unknown>> = []
    queries: Array<string> = []
    level = ""
    destroyed = false

    reset(): void {
        this.mode = "ok"
        this.authorized = true
        this.destroyError = undefined
        this.connectError = undefined
        this.dialogs = []
        this.messages = []
        this.windows = []
        this.queries = []
        this.level = ""
        this.destroyed = false
    }
}

const mockTg = new MockTelegram()

jest.mock("telegram/extensions/Logger", () => ({ LogLevel: { NONE: "none" } }))
jest.mock("telegram/Password", () => ({
    computeCheck: (_pwd: unknown, password: string) => Promise.resolve(`check:${password}`),
}))
jest.mock("telegram/sessions", () => ({
    StringSession: class {
        constructor(readonly saved: string) {}
        save(): string {
            return "saved-session"
        }
    },
}))
jest.mock("telegram", () => {
    class User {
        constructor(fields: Record<string, unknown>) {
            Object.assign(this, fields)
        }
    }
    class Chat {
        constructor(fields: Record<string, unknown>) {
            Object.assign(this, fields)
        }
    }
    class Channel {
        constructor(fields: Record<string, unknown>) {
            Object.assign(this, fields)
        }
    }
    class AuthorizationSignUpRequired {}
    const senderOf = (kind: unknown): unknown => {
        if (kind === "user") return new User({ firstName: "Ada", lastName: "Lovelace", username: "ada" })
        if (kind === "bare") return new User({ firstName: "", lastName: "", username: "ada" })
        if (kind === "chat") return new Chat({ title: "Shop" })
        if (kind === "channel") return new Channel({ title: "News" })
        return {}
    }
    class Query {
        constructor(
            readonly kind: string,
            readonly fields: Record<string, unknown> = {},
        ) {}
    }
    return {
        Api: {
            User,
            Chat,
            Channel,
            auth: {
                AuthorizationSignUpRequired,
                ResendCode: class extends Query {
                    constructor(fields: Record<string, unknown>) {
                        super("resend", fields)
                    }
                },
                SignIn: class extends Query {
                    constructor(fields: Record<string, unknown>) {
                        super("signin", fields)
                    }
                },
                CheckPassword: class extends Query {
                    constructor(fields: Record<string, unknown>) {
                        super("check", fields)
                    }
                },
                LogOut: class extends Query {
                    constructor() {
                        super("logout")
                    }
                },
            },
            account: {
                GetPassword: class extends Query {
                    constructor() {
                        super("password")
                    }
                },
            },
        },
        TelegramClient: class {
            readonly session: SavedSession
            constructor(
                session: SavedSession,
                readonly apiId: number,
                readonly apiHash: string,
            ) {
                this.session = session
            }
            setLogLevel(level: string): void {
                mockTg.level = level
            }
            connect(): Promise<void> {
                return mockTg.connectError === undefined ? Promise.resolve() : Promise.reject(mockTg.connectError)
            }
            destroy(): Promise<void> {
                mockTg.destroyed = true
                return mockTg.destroyError === undefined ? Promise.resolve() : Promise.reject(mockTg.destroyError)
            }
            sendCode(): Promise<{ phoneCodeHash: string; isCodeViaApp: boolean }> {
                return Promise.resolve({ phoneCodeHash: "hash-1", isCodeViaApp: true })
            }
            getMe(): Promise<InstanceType<typeof User>> {
                return Promise.resolve(new User({ firstName: "Ada", lastName: "", username: "ada" }))
            }
            invoke(query: Query): Promise<unknown> {
                mockTg.queries.push(query.kind)
                if (mockTg.mode === "signup") return Promise.resolve(new AuthorizationSignUpRequired())
                if (mockTg.mode === "password") return Promise.reject({ errorMessage: "SESSION_PASSWORD_NEEDED" })
                if (mockTg.mode === "invalid") return Promise.reject({ errorMessage: "PHONE_CODE_INVALID" })
                if (mockTg.mode === "down") return Promise.reject(new Error("offline"))
                if (query.kind === "resend")
                    return Promise.resolve(mockTg.mode === "same" ? {} : { phoneCodeHash: "hash-2" })
                return Promise.resolve({})
            }
            checkAuthorization(): Promise<boolean> {
                return Promise.resolve(mockTg.authorized)
            }
            *iterDialogs(): Generator<Record<string, unknown>> {
                for (const dialog of mockTg.dialogs) {
                    yield dialog.entityKind === undefined ? dialog : { ...dialog, entity: senderOf(dialog.entityKind) }
                }
            }
            getMessages(_entity: unknown, window: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
                mockTg.windows.push(window)
                return Promise.resolve(
                    mockTg.messages.map((message) =>
                        message.senderKind === undefined
                            ? message
                            : { ...message, sender: senderOf(message.senderKind) },
                    ),
                )
            }
        },
    }
})

const configured: DataSourcesOptions = {
    allowPrivateHosts: false,
    telegramUser: { apiId: 100, apiHash: new Secret(" hash ") },
}

const build = async (options: DataSourcesOptions = configured) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramUserClient,
            { provide: DATA_SOURCES_OPTIONS, useValue: options },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client: moduleRef.get(TelegramUserClient), logger }
}

const read = (partial: Partial<TelegramReadRequest> = {}): TelegramReadRequest => ({
    session: "session-1",
    chatIds: ["10"],
    cursors: new Map([["10", 4]]),
    sinceUnix: 1_700_000_000,
    perChatLimit: 2,
    isExpired: () => false,
    ...partial,
})

describe("TelegramUserClient", () => {
    beforeEach(() => {
        mockTg.reset()
    })

    it("reports whether the deployment has credentials", async () => {
        const ready = await build()
        const missing = await build({ allowPrivateHosts: false, telegramUser: null })

        expect(ready.client.configured()).toBe(true)
        expect(missing.client.configured()).toBe(false)
        await expect(missing.client.sendCode("+841234")).rejects.toMatchObject({
            code: DataSourcesErrorCode.Unavailable,
            params: { detail: TELEGRAM_USER_TEXT.notConfigured },
        })
        await expect(missing.client.logOut("session-1")).resolves.toBeUndefined()
    })

    it("sends and resends a code, and signs in or asks for the password", async () => {
        const { client } = await build()

        await expect(client.sendCode("+841234")).resolves.toEqual({
            phoneCodeHash: "hash-1",
            session: "saved-session",
            viaApp: true,
        })
        expect(mockTg.level).toBe("none")

        await expect(
            client.resendCode({ phone: "+841234", phoneCodeHash: "hash-1", session: "session-1" }),
        ).resolves.toEqual({ phoneCodeHash: "hash-2", session: "saved-session" })
        mockTg.mode = "same"
        await expect(
            client.resendCode({ phone: "+841234", phoneCodeHash: "hash-1", session: "session-1" }),
        ).resolves.toEqual({ phoneCodeHash: "hash-1", session: "saved-session" })

        mockTg.mode = "ok"
        await expect(
            client.signIn({ phone: "+841234", phoneCodeHash: "hash-1", session: "session-1", code: "12345" }),
        ).resolves.toEqual({
            kind: "ready",
            session: "saved-session",
            account: { displayName: "Ada", username: "ada" },
        })
        mockTg.mode = "password"
        await expect(
            client.signIn({ phone: "+841234", phoneCodeHash: "hash-1", session: "session-1", code: "12345" }),
        ).resolves.toEqual({ kind: "password", session: "saved-session" })
        mockTg.mode = "signup"
        await expect(
            client.signIn({ phone: "+841234", phoneCodeHash: "hash-1", session: "session-1", code: "12345" }),
        ).rejects.toMatchObject({
            code: DataSourcesErrorCode.Rejected,
            params: { detail: TELEGRAM_USER_TEXT.noAccount },
        })
    })

    it("checks the two-step password and maps a known or unknown Telegram failure", async () => {
        const { client, logger } = await build()

        await expect(client.checkPassword({ session: "session-1", password: "pw" })).resolves.toEqual({
            session: "saved-session",
            account: { displayName: "Ada", username: "ada" },
        })
        expect(mockTg.queries).toEqual(["password", "check"])

        mockTg.mode = "invalid"
        await expect(client.sendCode("+841234")).resolves.toBeDefined()
        mockTg.connectError = { errorMessage: "PHONE_CODE_INVALID" }
        await expect(client.sendCode("+841234")).rejects.toMatchObject({
            code: DataSourcesErrorCode.Rejected,
            params: { detail: TELEGRAM_USER_TEXT.codeInvalid },
        })
        mockTg.connectError = new Error("offline")
        await expect(client.sendCode("+841234")).rejects.toMatchObject({
            code: DataSourcesErrorCode.Unavailable,
            params: { detail: TELEGRAM_USER_TEXT.unavailable },
        })
        mockTg.connectError = undefined
        mockTg.destroyError = new Error("close")
        await client.sendCode("+841234")
        expect(logger.error).toHaveBeenCalledWith(TelegramUserLogEvent.CloseFailed, mockTg.destroyError, {})
    })

    it("lists chats and skips one without an id", async () => {
        const { client } = await build()
        const long = "x".repeat(130)
        mockTg.dialogs = [
            { id: undefined, title: "skip", isUser: true, unreadCount: 0 },
            { id: { toString: () => "10" }, title: "", name: "", isUser: true, unreadCount: 1 },
            { id: { toString: () => "11" }, title: long, isGroup: true, unreadCount: 0 },
            { id: { toString: () => "12" }, title: "News", isUser: false, isGroup: false, unreadCount: 3 },
        ]

        await expect(client.listDialogs("session-1", 20)).resolves.toEqual([
            { id: "10", title: "10", kind: "user", unread: 1 },
            { id: "11", title: "x".repeat(120), kind: "group", unread: 0 },
            { id: "12", title: "News", kind: "channel", unread: 3 },
        ])
    })

    it("reads new messages from a cursor or the window start and skips service or empty ones", async () => {
        const { client } = await build()
        mockTg.dialogs = [{ id: { toString: () => "10" }, entityKind: "user", title: "Ada" }]
        mockTg.messages = [
            { id: 3, className: "MessageService", message: "", date: 1 },
            { id: 6, className: "Message", message: "hey", date: 2, media: undefined, out: false, senderKind: "user" },
            {
                id: 7,
                className: "Message",
                message: "hi",
                date: 3,
                out: true,
                senderKind: "user",
                media: { className: "MessageMediaPhoto" },
                replyToMsgId: 4,
            },
            {
                id: 8,
                className: "Message",
                message: "shop",
                date: 4,
                out: false,
                senderKind: "chat",
                media: { className: "MessageMediaEmpty" },
            },
            { id: 9, className: "Message", message: "news", date: 5, out: false, senderKind: "channel" },
            { id: 10, className: "Message", message: "other", date: 6, out: false, senderKind: "other" },
            { id: 11, className: "Message", message: "ada", date: 7, out: false, senderKind: "bare" },
        ]

        await expect(client.readChats(read())).resolves.toEqual([
            {
                chatId: "10",
                maxId: 11,
                capped: true,
                messages: [
                    { id: 6, date: 2, text: "hey", senderName: "Ada Lovelace", replyToId: null, hasMedia: false },
                    { id: 7, date: 3, text: "hi", senderName: TELEGRAM_USER_TEXT.me, replyToId: 4, hasMedia: true },
                    { id: 8, date: 4, text: "shop", senderName: "Shop", replyToId: null, hasMedia: false },
                    { id: 9, date: 5, text: "news", senderName: "News", replyToId: null, hasMedia: false },
                    { id: 10, date: 6, text: "other", senderName: "", replyToId: null, hasMedia: false },
                    { id: 11, date: 7, text: "ada", senderName: "ada", replyToId: null, hasMedia: false },
                ],
            },
        ])
        expect(mockTg.windows[0]).toEqual({ reverse: true, offsetId: 4, limit: 2 })

        mockTg.dialogs = [{ id: { toString: () => "10" }, entityKind: "user", title: "Ada" }]
        await expect(client.readChats(read({ cursors: new Map(), chatIds: ["10", "11"] }))).resolves.toHaveLength(1)
        expect(mockTg.windows.at(-1)).toEqual({ reverse: true, offsetDate: 1_700_000_000, limit: 2 })
    })

    it("refuses a revoked session, stops when the run expires, and logs a logout that fails", async () => {
        const { client, logger } = await build()
        mockTg.authorized = false
        await expect(client.readChats(read())).rejects.toMatchObject({
            code: DataSourcesErrorCode.Rejected,
            params: { detail: TELEGRAM_USER_TEXT.revoked },
        })

        mockTg.authorized = true
        mockTg.dialogs = [{ id: { toString: () => "10" }, entity: undefined, title: "Ada" }]
        await expect(client.readChats(read({ isExpired: () => true }))).resolves.toEqual([])

        await expect(client.logOut("")).resolves.toBeUndefined()
        mockTg.mode = "down"
        await expect(client.logOut("session-1")).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalledWith(TelegramUserLogEvent.LogOutFailed, expect.any(Error), {})
    })
})
