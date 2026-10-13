import { Injectable } from "@nestjs/common"
import { Api, TelegramClient } from "telegram"
import type { Entity } from "telegram/define"
import { LogLevel } from "telegram/extensions/Logger"
import { computeCheck } from "telegram/Password"
import { StringSession } from "telegram/sessions"
import type { Dialog } from "telegram/tl/custom/dialog"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectDataSourcesOptions } from "./data-sources.decorators"
import type { DataSourcesOptions } from "./data-sources.options"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import type {
    TelegramAccount,
    TelegramChatChoice,
    TelegramChatKind,
    TelegramChatRead,
    TelegramCodeResent,
    TelegramCodeSent,
    TelegramCodeSubmission,
    TelegramLoggedIn,
    TelegramLoginSession,
    TelegramPasswordSubmission,
    TelegramRawMessage,
    TelegramReadRequest,
    TelegramSignInResult,
} from "./telegram-user.contracts"
import { TelegramUserLogEvent } from "./telegram-user.log-events"
import { TELEGRAM_USER_TEXT } from "./messages/telegram-user.messages"
import {
    TELEGRAM_NOT_CONFIGURED_MESSAGE,
    TELEGRAM_REVOKED_MESSAGE,
    explainTelegramError,
    isKnownTelegramError,
    telegramErrorCode,
} from "./telegram-user-errors.policy"

interface AppCredentials {
    readonly apiId: number
    readonly apiHash: string
}

const SESSION_PASSWORD_NEEDED = "SESSION_PASSWORD_NEEDED"

const kindOf = (dialog: Dialog): TelegramChatKind => {
    if (dialog.isUser === true) return "user"
    return dialog.isGroup === true ? "group" : "channel"
}

const joinName = (first: string | undefined, last: string | undefined): string =>
    [first, last].filter((part) => part !== undefined && part !== "").join(" ")

const nameOfSender = (sender: unknown): string => {
    if (sender instanceof Api.User) {
        const full = joinName(sender.firstName, sender.lastName)
        return full === "" ? (sender.username ?? "") : full
    }
    if (sender instanceof Api.Chat || sender instanceof Api.Channel) return sender.title
    return ""
}

const accountOf = (me: Api.User): TelegramAccount => ({
    displayName: joinName(me.firstName, me.lastName),
    username: me.username ?? null,
})

const revoked = (): DataSourcesError =>
    new DataSourcesError({ code: DataSourcesErrorCode.Rejected, params: { detail: TELEGRAM_REVOKED_MESSAGE } })

@Injectable()
/**
 * Personal Telegram (MTProto user session), READ ONLY. It connects, lists dialogs, reads messages and signs the
 * session out; it never sends, marks read, joins or edits. Codes, passwords and sessions are never logged.
 */
export class TelegramUserClient {
    constructor(
        @InjectDataSourcesOptions() private readonly options: DataSourcesOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** True when the deployment has the Telegram app credentials. */
    configured(): boolean {
        return this.options.telegramUser !== null
    }

    /** Sends the login code to a phone number (E.164). */
    sendCode(phone: string): Promise<TelegramCodeSent> {
        return this.run("", async (client, app) => {
            const sent = await client.sendCode(app, phone)
            return {
                phoneCodeHash: sent.phoneCodeHash,
                session: String(client.session.save()),
                viaApp: sent.isCodeViaApp,
            }
        })
    }

    /** Asks Telegram for a fresh code of a login in progress. */
    resendCode(login: TelegramLoginSession): Promise<TelegramCodeResent> {
        return this.run(login.session, async (client) => {
            const sent = await client.invoke(
                new Api.auth.ResendCode({ phoneNumber: login.phone, phoneCodeHash: login.phoneCodeHash }),
            )
            return {
                phoneCodeHash: "phoneCodeHash" in sent ? sent.phoneCodeHash : login.phoneCodeHash,
                session: String(client.session.save()),
            }
        })
    }

    /** Signs in with the code; answers "password" when the account has two-step verification. */
    signIn(login: TelegramCodeSubmission): Promise<TelegramSignInResult> {
        return this.run(login.session, async (client): Promise<TelegramSignInResult> => {
            try {
                const result = await client.invoke(
                    new Api.auth.SignIn({
                        phoneNumber: login.phone,
                        phoneCodeHash: login.phoneCodeHash,
                        phoneCode: login.code,
                    }),
                )
                if (result instanceof Api.auth.AuthorizationSignUpRequired) {
                    throw new DataSourcesError({
                        code: DataSourcesErrorCode.Rejected,
                        params: { detail: TELEGRAM_USER_TEXT.noAccount },
                    })
                }
            } catch (error) {
                if (telegramErrorCode(error) !== SESSION_PASSWORD_NEEDED) throw error
                return { kind: "password", session: String(client.session.save()) }
            }
            return { kind: "ready", session: String(client.session.save()), account: accountOf(await client.getMe()) }
        })
    }

    /** Proves the two-step verification password; it is used once and never kept. */
    checkPassword(login: TelegramPasswordSubmission): Promise<TelegramLoggedIn> {
        return this.run(login.session, async (client) => {
            const pwd = await client.invoke(new Api.account.GetPassword())
            await client.invoke(new Api.auth.CheckPassword({ password: await computeCheck(pwd, login.password) }))
            return { session: String(client.session.save()), account: accountOf(await client.getMe()) }
        })
    }

    /** The recent chats of the account, for the picker. */
    listDialogs(session: string, limit: number): Promise<ReadonlyArray<TelegramChatChoice>> {
        return this.run(session, async (client) => {
            const out: Array<TelegramChatChoice> = []
            for await (const dialog of client.iterDialogs({ limit })) {
                if (dialog.id === undefined) continue
                const id = dialog.id.toString()
                const title = (dialog.title ?? dialog.name ?? id).slice(0, 120)
                out.push({ id, title: title === "" ? id : title, kind: kindOf(dialog), unread: dialog.unreadCount })
            }
            return out
        })
    }

    /** Reads the new messages of the picked chats, oldest first, from each chat's cursor (or the window start). */
    readChats(request: TelegramReadRequest): Promise<ReadonlyArray<TelegramChatRead>> {
        return this.run(request.session, async (client) => {
            if (!(await client.checkAuthorization())) throw revoked()
            const wanted = new Set(request.chatIds)
            // Dialogs fill the entity cache (access hashes) that a fresh StringSession does not carry.
            const entities = new Map<string, Entity>()
            for await (const dialog of client.iterDialogs({ limit: 1000 })) {
                if (request.isExpired()) break
                const id = dialog.id?.toString()
                if (id !== undefined && wanted.has(id) && dialog.entity !== undefined) {
                    entities.set(id, dialog.entity)
                    if (entities.size === wanted.size) break
                }
            }
            const reads: Array<TelegramChatRead> = []
            await eachInOrder(request.chatIds, async (chatId) => {
                const entity = entities.get(chatId)
                if (request.isExpired() || entity === undefined) return
                const cursor = request.cursors.get(chatId) ?? 0
                const window =
                    cursor > 0
                        ? { reverse: true, offsetId: cursor, limit: request.perChatLimit }
                        : { reverse: true, offsetDate: request.sinceUnix, limit: request.perChatLimit }
                const found = await client.getMessages(entity, window)
                const messages: Array<TelegramRawMessage> = []
                let maxId = cursor
                for (const message of found) {
                    if (message.id > maxId) maxId = message.id
                    // Service messages ("X joined") are skipped but still move the cursor.
                    if (message.className !== "Message") continue
                    const hasMedia = message.media !== undefined && message.media.className !== "MessageMediaEmpty"
                    if (message.message === "" && !hasMedia) continue
                    messages.push({
                        id: message.id,
                        date: message.date,
                        text: message.message,
                        senderName: message.out === true ? TELEGRAM_USER_TEXT.me : nameOfSender(message.sender),
                        replyToId: message.replyToMsgId ?? null,
                        hasMedia,
                    })
                }
                reads.push({ chatId, messages, maxId, capped: found.length >= request.perChatLimit })
            })
            return reads
        })
    }

    /** Ends the Telegram session when possible; an already gone or unreachable session is not an error. */
    async logOut(session: string): Promise<void> {
        if (!this.configured() || session === "") return
        try {
            await this.run(session, (client) => client.invoke(new Api.auth.LogOut()))
        } catch (cause) {
            this.logger.error(TelegramUserLogEvent.LogOutFailed, cause, {})
        }
    }

    private async run<T>(
        session: string,
        work: (client: TelegramClient, app: AppCredentials) => Promise<T>,
    ): Promise<T> {
        const options = this.options.telegramUser
        if (options === null) {
            throw new DataSourcesError({
                code: DataSourcesErrorCode.Unavailable,
                params: { detail: TELEGRAM_NOT_CONFIGURED_MESSAGE },
            })
        }
        const app: AppCredentials = { apiId: options.apiId, apiHash: options.apiHash.reveal().trim() }
        const client = new TelegramClient(new StringSession(session), app.apiId, app.apiHash, {
            connectionRetries: 2,
            deviceModel: "NIVO",
            appVersion: "1.0",
        })
        client.setLogLevel(LogLevel.NONE)
        try {
            await client.connect()
            return await work(client, app)
        } catch (error) {
            throw this.translate(error)
        } finally {
            await client
                .destroy()
                .catch((cause: unknown) => this.logger.error(TelegramUserLogEvent.CloseFailed, cause, {}))
        }
    }

    private translate(error: unknown): DataSourcesError {
        if (error instanceof DataSourcesError) return error
        return new DataSourcesError({
            code: isKnownTelegramError(error) ? DataSourcesErrorCode.Rejected : DataSourcesErrorCode.Unavailable,
            params: { detail: explainTelegramError(error) },
            cause: error,
        })
    }
}
