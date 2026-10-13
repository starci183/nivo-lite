import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor } from "@modules/domain/connections"
import {
    InjectTelegramUser,
    TELEGRAM_NOT_CONFIGURED_MESSAGE,
    TELEGRAM_REVOKED_MESSAGE,
} from "@modules/integrations/data-sources"
import type { TelegramChatChoice, TelegramUserClient } from "@modules/integrations/data-sources"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import type { DataConnection } from "./data-hub.contracts"
import { DataHubService } from "./data-hub.service"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import {
    MAX_CHATS,
    SCHEDULE_CHOICES,
    accountLabel,
    cleanChats,
    normalizePhone,
    parseConfig,
    serializeConfig,
    summaryOf,
    toSinceDays,
} from "./telegram-user-config.policy"
import { loginExpired, parseCredential, serializeCredential } from "./telegram-user-credential.policy"
import type {
    PendingTelegramLogin,
    SaveTelegramSetupInput,
    TelegramCodeEntry,
    TelegramCredential,
    TelegramLoginDraft,
    TelegramLoginProgress,
    TelegramLoginStarted,
    TelegramLoginState,
    TelegramPasswordEntry,
    TelegramSetupState,
} from "./telegram-user-wizard.contracts"
import { TELEGRAM_WIZARD_TEXT as TEXT } from "./messages/telegram-user-wizard.messages"

const PROVIDER = "telegram_user" as const
const DIALOG_LIMIT = 100

const invalid = (detail: string): DataHubError =>
    new DataHubError({ code: DataHubErrorCode.Invalid, params: { detail } })

const statusOf = (connection: DataConnection): TelegramSetupState["status"] => {
    if (connection.status === "pending") return "pending"
    return connection.status === "error" ? "error" : "connected"
}

@Injectable()
/** The wizard operations of the personal Telegram accounts. The login state and the session live only in the sealed credential. */
export class TelegramUserWizardService {
    constructor(
        private readonly hub: DataHubService,
        private readonly connections: ConnectionsService,
        @InjectTelegramUser() private readonly telegram: TelegramUserClient,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Whether the deployment can log in a personal Telegram account. */
    async ready(actor: ConnectionActor): Promise<boolean> {
        await this.hub.owner(actor)
        return this.telegram.configured()
    }

    /** Where to continue a pending login or edit the picks of a connected account. */
    async load(actor: ConnectionActor, connectionId: string): Promise<TelegramSetupState> {
        await this.hub.owner(actor)
        const connection = await this.hub.own(actor.workspaceId, connectionId, PROVIDER)
        const credential = await this.credentialOf(connection.id)
        const pending = connection.status === "pending"
        if (pending && (credential.login === undefined || this.expired(credential.login))) {
            throw invalid(TEXT.expired)
        }
        return {
            name: connection.name,
            status: statusOf(connection),
            stage: pending && credential.login !== undefined ? credential.login.stage : "ready",
            config: parseConfig(connection.meta.config),
            everyMinutes: connection.everyMinutes,
            consent: Boolean(connection.meta.consentAt),
        }
    }

    /** Sends the login code; creates the pending connection on the first call, or reuses `connectionId` (a corrected number). */
    async startLogin(actor: ConnectionActor, input: TelegramLoginDraft): Promise<TelegramLoginStarted> {
        await this.hub.owner(actor)
        if (!this.telegram.configured()) throw invalid(TELEGRAM_NOT_CONFIGURED_MESSAGE)
        if (!input.consent) throw invalid(TEXT.consent)
        const name = input.name.trim().slice(0, 80)
        if (name === "") throw invalid(TEXT.nameRequired)
        const phone = normalizePhone(input.phone)
        if (phone === null) throw invalid(TEXT.phoneInvalid)
        const existing = await this.pendingConnection(actor.workspaceId, input.connectionId)

        const sent = await this.telegram.sendCode(phone)
        const now = this.clock.now()
        const credential = serializeCredential({
            login: {
                stage: "code",
                phone,
                phoneCodeHash: sent.phoneCodeHash,
                session: sent.session,
                startedAt: now.getTime(),
            },
        })
        const meta = { consentAt: now.toISOString() }
        if (existing !== null) {
            await this.hub.saveCredential(existing.id, credential)
            await this.connections.patch(actor.workspaceId, existing.id, { name, meta: { ...existing.meta, ...meta } })
            return { connectionId: existing.id, viaApp: sent.viaApp }
        }
        const connectionId = await this.hub.create(actor, {
            provider: PROVIDER,
            name,
            meta,
            credential,
            everyMinutes: null,
            status: "pending",
        })
        return { connectionId, viaApp: sent.viaApp }
    }

    /** Asks Telegram for a fresh code (the login keeps its 10 minute life from the first code). */
    async resendCode(actor: ConnectionActor, connectionId: string): Promise<void> {
        await this.hub.owner(actor)
        const { connection, login } = await this.pendingLogin(actor.workspaceId, connectionId)
        const resent = await this.telegram.resendCode(login)
        await this.hub.saveCredential(
            connection.id,
            serializeCredential({ login: { ...login, stage: "code", ...resent } }),
        )
    }

    /** The code from Telegram; answers the next stage: "password" with two-step verification, otherwise "ready". */
    async submitCode(actor: ConnectionActor, input: TelegramCodeEntry): Promise<TelegramLoginProgress> {
        await this.hub.owner(actor)
        const { connection, login } = await this.pendingLogin(actor.workspaceId, input.connectionId)
        const code = input.code.replace(/\D/gu, "")
        if (code.length < 4 || code.length > 8) throw invalid(TEXT.codeLength)
        const result = await this.telegram.signIn({ ...login, code })
        if (result.kind === "password") {
            await this.hub.saveCredential(
                connection.id,
                serializeCredential({ login: { ...login, stage: "password", session: result.session } }),
            )
            return { stage: "password" }
        }
        await this.finishLogin(
            connection,
            result.session,
            accountLabel(result.account.displayName, result.account.username, login.phone),
        )
        return { stage: "ready" }
    }

    /** The two-step verification password; used once to prove the login and never stored. */
    async submitPassword(actor: ConnectionActor, input: TelegramPasswordEntry): Promise<TelegramLoginProgress> {
        await this.hub.owner(actor)
        const { connection, login } = await this.pendingLogin(actor.workspaceId, input.connectionId)
        if (login.stage !== "password") throw invalid(TEXT.passwordNotNeeded)
        if (input.password === "") throw invalid(TEXT.passwordRequired)
        const result = await this.telegram.checkPassword({ session: login.session, password: input.password })
        await this.finishLogin(
            connection,
            result.session,
            accountLabel(result.account.displayName, result.account.username, login.phone),
        )
        return { stage: "ready" }
    }

    /** Cancels a login in progress: drops the pending connection and its temporary session. A connected account is left alone. */
    async cancelLogin(actor: ConnectionActor, connectionId: string): Promise<void> {
        await this.hub.owner(actor)
        const connection = await this.hub.own(actor.workspaceId, connectionId, PROVIDER)
        if (connection.status !== "pending") return
        await this.hub.remove(actor.workspaceId, connection.id)
    }

    /** Recent chats of the account (read only), for the picker. */
    async listChats(actor: ConnectionActor, connectionId: string): Promise<ReadonlyArray<TelegramChatChoice>> {
        await this.hub.owner(actor)
        const connection = await this.hub.own(actor.workspaceId, connectionId, PROVIDER)
        const credential = await this.credentialOf(connection.id)
        if (credential.session === undefined) throw invalid(TELEGRAM_REVOKED_MESSAGE)
        return this.telegram.listDialogs(credential.session, DIALOG_LIMIT)
    }

    /** Saves the ticked chats, the first window and the schedule; the connection becomes connected. */
    async saveSetup(actor: ConnectionActor, input: SaveTelegramSetupInput): Promise<void> {
        await this.hub.owner(actor)
        const connection = await this.hub.own(actor.workspaceId, input.connectionId, PROVIDER)
        const credential = await this.credentialOf(connection.id)
        if (credential.session === undefined) throw invalid(TEXT.notLoggedIn)
        const everyMinutes = input.everyMinutes ?? null
        if (!SCHEDULE_CHOICES.includes(everyMinutes)) throw invalid(TEXT.scheduleInvalid)
        if (input.chats.length > MAX_CHATS) throw invalid(TEXT.tooManyChats(MAX_CHATS))
        const chats = cleanChats(input.chats)
        if (chats.length === 0) throw invalid(TEXT.pickOne)
        await this.hub.update(actor.workspaceId, connection.id, {
            name: connection.name,
            meta: {
                ...connection.meta,
                config: serializeConfig({ chats, sinceDays: toSinceDays(input.sinceDays) }),
                summary: summaryOf(chats.length),
            },
            everyMinutes,
        })
    }

    /** Ends the Telegram sessions of a connection and blanks its credential; call it only after an owner check. */
    async forgetSession(workspaceId: string, connectionId: string): Promise<void> {
        const connection = await this.hub.own(workspaceId, connectionId, PROVIDER)
        const credential = await this.credentialOf(connection.id)
        const sessions = [credential.session, credential.login?.session].filter(
            (session): session is string => session !== undefined,
        )
        try {
            await eachInOrder(sessions, (session) => this.telegram.logOut(session))
        } finally {
            await this.hub.saveCredential(connection.id, "{}")
        }
    }

    private expired(login: TelegramLoginState): boolean {
        return loginExpired(login, this.clock.now().getTime())
    }

    private async credentialOf(connectionId: string): Promise<TelegramCredential> {
        return parseCredential(await this.hub.credentialOf(connectionId))
    }

    private async pendingConnection(
        workspaceId: string,
        connectionId: string | null | undefined,
    ): Promise<DataConnection | null> {
        if (connectionId === undefined || connectionId === null) return null
        const connection = await this.hub.own(workspaceId, connectionId, PROVIDER)
        if (connection.status !== "pending") throw invalid(TEXT.alreadyLoggedIn)
        return connection
    }

    private async pendingLogin(workspaceId: string, connectionId: string): Promise<PendingTelegramLogin> {
        const connection = await this.hub.own(workspaceId, connectionId, PROVIDER)
        const credential = await this.credentialOf(connection.id)
        if (connection.status !== "pending" || credential.login === undefined) throw invalid(TEXT.noPendingLogin)
        if (this.expired(credential.login)) throw invalid(TEXT.expired)
        return { connection, login: credential.login }
    }

    private async finishLogin(connection: DataConnection, session: string, account: string): Promise<void> {
        await this.hub.saveCredential(connection.id, serializeCredential({ session }))
        await this.connections.patch(connection.workspaceId, connection.id, { meta: { ...connection.meta, account } })
    }
}
