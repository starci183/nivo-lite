import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import * as telegram from "telegram"
import { Api } from "telegram"
import type { TelegramClient } from "telegram"
import type { Entity } from "telegram/define"
import { returnBigInt, TotalList } from "telegram/Helpers"
import * as password from "telegram/Password"
import * as sessions from "telegram/sessions"
import type { StringSession } from "telegram/sessions"
import type { Dialog } from "telegram/tl/custom/dialog"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DataSourcesError, DataSourcesErrorCode } from "@modules/integrations/data-sources"
import { TELEGRAM_USER_OPTIONS } from "./telegram-user.decorators"
import type { TelegramUserOptions } from "./telegram-user.options"
import { TELEGRAM_USER_TEXT } from "./messages/telegram-user.messages"
import { TelegramUserClient } from "./telegram-user.client"
import type { TelegramReadRequest, TelegramUserErrors } from "./telegram-user.contracts"
import { TelegramUserLogEvent } from "./telegram-user.log-events"

/** How the fake Telegram answers the requests of a test. */
class MockTelegram {
    mode = "ok"
    authorized = true
    destroyError: Error | undefined = undefined
    connectError: unknown = undefined
    dialogs: Array<Dialog> = []
    messages: Array<Api.Message> = []
    windows: Array<unknown> = []
    queries: Array<string> = []
    level = ""
    destroyed = false
    me = new Api.User({ id: returnBigInt(1), firstName: "Ada", lastName: "", username: "ada" })
}

const mockTg = new MockTelegram()

const ada = (): Api.User =>
    new Api.User({ id: returnBigInt(1), firstName: "Ada", lastName: "Lovelace", username: "ada" })

const senderOf = (kind: string): Entity | undefined => {
    if (kind === "user") return ada()
    if (kind === "bare") return new Api.User({ id: returnBigInt(2), firstName: "", lastName: "", username: "ada" })
    if (kind === "nameless") return new Api.User({ id: returnBigInt(2) })
    if (kind === "chat") {
        return new Api.Chat({
            id: returnBigInt(3),
            title: "Shop",
            photo: new Api.ChatPhotoEmpty(),
            participantsCount: 2,
            date: 1,
            version: 1,
        })
    }
    if (kind === "channel") {
        return new Api.Channel({ id: returnBigInt(4), title: "News", photo: new Api.ChatPhotoEmpty(), date: 1 })
    }
    return undefined
}

interface DialogShape {
    readonly id: string | undefined
    readonly title?: string
    readonly name?: string
    readonly isUser?: boolean
    readonly isGroup?: boolean
    readonly unreadCount?: number
    readonly entityKind?: string
}

/** A dialog with every field the client reads written out, so none falls back to a generated mock. */
const dialogOf = (shape: DialogShape): Dialog =>
    mock<Dialog>({
        id: shape.id === undefined ? undefined : returnBigInt(shape.id),
        title: shape.title,
        name: shape.name,
        isUser: shape.isUser ?? false,
        isGroup: shape.isGroup ?? false,
        unreadCount: shape.unreadCount ?? 0,
        entity: shape.entityKind === undefined ? undefined : senderOf(shape.entityKind),
    })

interface MessageShape {
    readonly id: number
    readonly className: string
    readonly message: string
    readonly date: number
    readonly out?: boolean
    readonly senderKind?: string
    readonly media?: Api.TypeMessageMedia
    readonly replyToMsgId?: number
}

/** A message with every field the client reads written out. */
const messageOf = (shape: MessageShape): Api.Message => {
    const message = mock<Api.Message>({
        id: shape.id,
        message: shape.message,
        date: shape.date,
        out: shape.out ?? false,
        media: shape.media,
        sender: shape.senderKind === undefined ? undefined : senderOf(shape.senderKind),
        replyToMsgId: shape.replyToMsgId,
    })
    Reflect.set(message, "className", shape.className)
    return message
}

async function* listed(dialogs: ReadonlyArray<Dialog>): AsyncGenerator<Dialog, void, undefined> {
    yield* await Promise.resolve(dialogs)
}

const telegramError = (errorMessage: string): Error => Object.assign(new Error(errorMessage), { errorMessage })

/** The answer of the fake to one request, by the mode of the test. */
const answerOf = (request: Api.AnyRequest): Promise<Api.AnyRequest["__response"]> => {
    mockTg.queries.push(request.className)
    if (mockTg.mode === "signup") return Promise.resolve(new Api.auth.AuthorizationSignUpRequired({}))
    if (mockTg.mode === "password") return Promise.reject(telegramError("SESSION_PASSWORD_NEEDED"))
    if (mockTg.mode === "invalid") return Promise.reject(telegramError("PHONE_CODE_INVALID"))
    if (mockTg.mode === "down") return Promise.reject(new Error("offline"))
    if (request instanceof Api.auth.ResendCode && mockTg.mode !== "same") {
        return Promise.resolve(
            new Api.auth.SentCode({ type: new Api.auth.SentCodeTypeApp({ length: 5 }), phoneCodeHash: "hash-2" }),
        )
    }
    return Promise.resolve(new Api.auth.Authorization({ user: ada() }))
}

/** The client of one connection: it answers from the state of the running test. */
const clientOf = (session: StringSession): TelegramClient => {
    const state = mockTg
    const client = mock<TelegramClient>({ session })
    client.setLogLevel.mockImplementation((level) => {
        state.level = level
    })
    client.connect.mockImplementation(() =>
        state.connectError === undefined ? Promise.resolve(true) : Promise.reject(state.connectError),
    )
    client.destroy.mockImplementation(() => {
        state.destroyed = true
        return state.destroyError === undefined ? Promise.resolve() : Promise.reject(state.destroyError)
    })
    client.sendCode.mockResolvedValue({ phoneCodeHash: "hash-1", isCodeViaApp: true })
    client.getMe.mockImplementation(() => Promise.resolve(state.me))
    client.invoke.mockImplementation(answerOf)
    client.checkAuthorization.mockImplementation(() => Promise.resolve(state.authorized))
    client.iterDialogs.mockImplementation(() =>
        mock<ReturnType<TelegramClient["iterDialogs"]>>({
            [Symbol.asyncIterator]: () => listed(state.dialogs),
        }),
    )
    client.getMessages.mockImplementation((_entity, window) => {
        state.windows.push(window)
        const found = new TotalList<Api.Message>()
        found.push(...state.messages)
        return Promise.resolve(found)
    })
    return client
}

const clientSpy = jest.spyOn(telegram, "TelegramClient")
const sessionSpy = jest.spyOn(sessions, "StringSession")
const checkSpy = jest.spyOn(password, "computeCheck")

const errors: TelegramUserErrors = {
    rejected: (detail, cause) =>
        new DataSourcesError({ code: DataSourcesErrorCode.Rejected, params: { detail }, cause }),
    unavailable: (detail, cause) =>
        new DataSourcesError({ code: DataSourcesErrorCode.Unavailable, params: { detail }, cause }),
    isError: (error): error is DataSourcesError => error instanceof DataSourcesError,
}

const configured: Omit<TelegramUserOptions, "errors"> = {
    app: { apiId: 100, apiHash: new Secret(" hash ") },
}

const build = async (options: Omit<TelegramUserOptions, "errors"> = configured) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramUserClient,
            { provide: TELEGRAM_USER_OPTIONS, useValue: { ...options, errors } },
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

afterAll(() => {
    jest.restoreAllMocks()
})

beforeEach(() => {
    Object.assign(mockTg, new MockTelegram())
    sessionSpy.mockImplementation(() => mock<StringSession>({ save: () => "saved-session" }))
    clientSpy.mockImplementation(() => clientOf(mock<StringSession>({ save: () => "saved-session" })))
    checkSpy.mockResolvedValue(
        new Api.InputCheckPasswordSRP({ srpId: returnBigInt(1), A: Buffer.from("a"), M1: Buffer.from("m") }),
    )
})

describe("TelegramUserClient", () => {
    it("reports whether the deployment has credentials", async () => {
        const ready = await build()
        const missing = await build({ app: null })

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
})

describe("TelegramUserClient", () => {
    it("checks the two-step password and maps a known or unknown Telegram failure", async () => {
        const { client, logger } = await build()

        await expect(client.checkPassword({ session: "session-1", password: "pw" })).resolves.toEqual({
            session: "saved-session",
            account: { displayName: "Ada", username: "ada" },
        })
        expect(mockTg.queries).toEqual(["account.GetPassword", "auth.CheckPassword"])

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
            dialogOf({ id: undefined, title: "skip", isUser: true, unreadCount: 0 }),
            dialogOf({ id: "10", title: "", name: "", isUser: true, unreadCount: 1 }),
            dialogOf({ id: "11", title: long, isGroup: true, unreadCount: 0 }),
            dialogOf({ id: "12", title: "News", isUser: false, isGroup: false, unreadCount: 3 }),
        ]

        await expect(client.listDialogs("session-1", 20)).resolves.toEqual([
            { id: "10", title: "10", kind: "user", unread: 1 },
            { id: "11", title: "x".repeat(120), kind: "group", unread: 0 },
            { id: "12", title: "News", kind: "channel", unread: 3 },
        ])
    })
})

describe("TelegramUserClient", () => {
    it("reads new messages from a cursor or the window start and skips service or empty ones", async () => {
        const { client } = await build()
        mockTg.dialogs = [dialogOf({ id: "10", entityKind: "user", title: "Ada" })]
        mockTg.messages = [
            messageOf({ id: 3, className: "MessageService", message: "", date: 1 }),
            messageOf({ id: 6, className: "Message", message: "hey", date: 2, out: false, senderKind: "user" }),
            messageOf({
                id: 7,
                className: "Message",
                message: "hi",
                date: 3,
                out: true,
                senderKind: "user",
                media: new Api.MessageMediaPhoto({}),
                replyToMsgId: 4,
            }),
            messageOf({
                id: 8,
                className: "Message",
                message: "shop",
                date: 4,
                out: false,
                senderKind: "chat",
                media: new Api.MessageMediaEmpty(),
            }),
            messageOf({ id: 9, className: "Message", message: "news", date: 5, out: false, senderKind: "channel" }),
            messageOf({ id: 10, className: "Message", message: "other", date: 6, out: false, senderKind: "other" }),
            messageOf({ id: 11, className: "Message", message: "ada", date: 7, out: false, senderKind: "bare" }),
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

        mockTg.dialogs = [dialogOf({ id: "10", entityKind: "user", title: "Ada" })]
        await expect(client.readChats(read({ cursors: new Map(), chatIds: ["10", "11"] }))).resolves.toHaveLength(1)
        expect(mockTg.windows.at(-1)).toEqual({ reverse: true, offsetDate: 1_700_000_000, limit: 2 })
    })
})

describe("TelegramUserClient", () => {
    it("refuses a revoked session, stops when the run expires, and logs a logout that fails", async () => {
        const { client, logger } = await build()
        mockTg.authorized = false
        await expect(client.readChats(read())).rejects.toMatchObject({
            code: DataSourcesErrorCode.Rejected,
            params: { detail: TELEGRAM_USER_TEXT.revoked },
        })

        mockTg.authorized = true
        mockTg.dialogs = [dialogOf({ id: "10", title: "Ada" })]
        await expect(client.readChats(read({ isExpired: () => true }))).resolves.toEqual([])

        await expect(client.logOut("")).resolves.toBeUndefined()
        mockTg.mode = "down"
        await expect(client.logOut("session-1")).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalledWith(TelegramUserLogEvent.LogOutFailed, expect.any(Error), {})
    })

    it("keeps missing account names and usernames empty, and logs out a valid session", async () => {
        const { client } = await build()
        mockTg.me = new Api.User({ id: returnBigInt(1) })

        await expect(client.checkPassword({ session: "session-1", password: "pw" })).resolves.toEqual({
            session: "saved-session",
            account: { displayName: "", username: null },
        })
        await expect(client.logOut("session-1")).resolves.toBeUndefined()
        expect(mockTg.queries).toEqual(["account.GetPassword", "auth.CheckPassword", "auth.LogOut"])
        expect(mockTg.destroyed).toBe(true)
    })

    it("uses a dialog name or id when the title is missing", async () => {
        const { client } = await build()
        mockTg.dialogs = [dialogOf({ id: "10", name: "Ada" }), dialogOf({ id: "11" })]

        await expect(client.listDialogs("session-1", 5)).resolves.toEqual([
            { id: "10", title: "Ada", kind: "channel", unread: 0 },
            { id: "11", title: "11", kind: "channel", unread: 0 },
        ])
    })
})

describe("TelegramUserClient", () => {
    it("skips unusable dialog entities and empty messages but keeps pure media", async () => {
        const { client } = await build()
        mockTg.dialogs = [
            dialogOf({ id: undefined, entityKind: "user" }),
            dialogOf({ id: "20", entityKind: "user" }),
            dialogOf({ id: "10" }),
            dialogOf({ id: "10", entityKind: "user" }),
        ]
        mockTg.messages = [
            messageOf({ id: 5, className: "Message", message: "", date: 1 }),
            messageOf({
                id: 6,
                className: "Message",
                message: "",
                date: 2,
                senderKind: "nameless",
                media: new Api.MessageMediaPhoto({}),
            }),
        ]

        await expect(client.readChats(read({ chatIds: ["10", "11"], perChatLimit: 3 }))).resolves.toEqual([
            {
                chatId: "10",
                maxId: 6,
                capped: false,
                messages: [{ id: 6, date: 2, text: "", senderName: "", replyToId: null, hasMedia: true }],
            },
        ])
        expect(mockTg.windows).toEqual([{ reverse: true, offsetId: 4, limit: 3 }])
    })

    it("stops before fetching messages when the deadline expires after discovering entities", async () => {
        const { client } = await build()
        mockTg.dialogs = [dialogOf({ id: "10", entityKind: "user" })]
        let checks = 0

        await expect(
            client.readChats(
                read({
                    isExpired: () => {
                        checks += 1
                        return checks > 1
                    },
                }),
            ),
        ).resolves.toEqual([])
        expect(mockTg.windows).toEqual([])
    })
})

describe("TelegramUserClient", () => {
    it.each([false, true])("propagates cleanup logger failures with connection failure %s", async (connectionFails) => {
        const { client, logger } = await build()
        const failure = new DataSourcesError({ code: DataSourcesErrorCode.Unavailable })
        mockTg.connectError = connectionFails ? { errorMessage: "PHONE_CODE_INVALID" } : undefined
        mockTg.destroyError = new Error("destroy unavailable")
        logger.error.mockImplementation(() => {
            throw failure
        })

        await expect(client.sendCode("+841234")).rejects.toBe(failure)
        expect(logger.error).toHaveBeenCalledWith(TelegramUserLogEvent.CloseFailed, mockTg.destroyError, {})
        expect(mockTg.destroyed).toBe(true)
    })

    it("propagates a synchronous failure when destroying the Telegram client", async () => {
        const { client, logger } = await build()
        const failure = new DataSourcesError({ code: DataSourcesErrorCode.Unavailable })
        const session = mock<StringSession>({ save: () => "saved-session" })
        const connection = mock<TelegramClient>({ session })
        connection.connect.mockResolvedValue(true)
        connection.sendCode.mockResolvedValue({ phoneCodeHash: "hash-1", isCodeViaApp: true })
        connection.destroy.mockImplementation(() => {
            throw failure
        })
        clientSpy.mockReturnValue(connection)

        await expect(client.sendCode("+841234")).rejects.toBe(failure)
        expect(logger.error).not.toHaveBeenCalled()
    })
})
