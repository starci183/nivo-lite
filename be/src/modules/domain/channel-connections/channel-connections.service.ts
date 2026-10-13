import { Injectable } from "@nestjs/common"
import {
    ConnectionsError,
    ConnectionsErrorCode,
    ConnectionsService,
    cleanConnectionName,
    randomSecret,
    sha256,
} from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord, FirstEventState, Provider } from "@modules/domain/connections"
import {
    ChannelSetupError,
    ChannelSetupErrorCode,
    InjectChannelSetupClient,
} from "@modules/integrations/channel-setup"
import type { ChannelSetupClient, ZaloSecret } from "@modules/integrations/channel-setup"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ChannelConnectionsError, ChannelConnectionsErrorCode } from "./errors/channel-connections.error"
import type {
    ConnectTelegramInput,
    ConnectionCheck,
    ProviderKeysResult,
    StartMoneyInput,
    TelegramConnected,
    UpdateMoneyInput,
    WizardConnection,
} from "./channel-connections.contracts"
import {
    chooseEnvironment,
    clean,
    isAccountNumber,
    isMoneyProvider,
    isSepayKey,
    isTelegramToken,
    maskAccount,
    moneyRules,
    squeeze,
} from "./money-provider.policy"
import { hasLiveTokens, parseZaloSecret } from "./zalo-secret.policy"

const OWNER = ["owner"] as const
const MANAGER = ["owner", "manager"] as const
const EMPTY_CREDENTIAL = "{}"
const KEY_MIN = 8
const KEY_MAX = 200

@Injectable()
/** The connection wizards of the chat channels and money feeds: Telegram bots, SePay / payOS / Casso feeds and Zalo OA. */
export class ChannelConnectionsService {
    constructor(
        private readonly connections: ConnectionsService,
        @InjectChannelSetupClient() private readonly setup: ChannelSetupClient,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Validates the token with getMe, stores it sealed, then points the bot webhook at this connection's own address. */
    async connectTelegram(actor: ConnectionActor, input: ConnectTelegramInput): Promise<TelegramConnected> {
        await this.connections.authorize(actor, OWNER)
        const name = this.requireName(input.name)
        const token = input.token.trim()
        if (!isTelegramToken(token)) {
            throw new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.TokenFormat })
        }
        const me = await this.viaSetup(() => this.setup.telegramGetMe(token))
        // One bot has one webhook: refuse a bot that is already live in a connection instead of stealing its customers.
        if ((await this.connections.findLiveByMeta("telegram", "bot_id", me.id)) !== null) {
            throw new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.BotInUse })
        }
        const secret = randomSecret()
        const id = await this.connections.create({
            workspaceId: actor.workspaceId,
            createdBy: actor.principalId,
            provider: "telegram",
            name,
            status: "connected",
            environment: "live",
            meta: { bot_id: me.id, bot_username: me.username },
            secret: { plain: token, webhookSecret: secret },
        })
        // setWebhook only works on a public https address; on localhost the connection is stored and registered later on the real domain.
        const origin = this.connections.publicOrigin()
        if (origin !== null) {
            try {
                await this.setup.telegramSetWebhook(token, this.connections.webhookUrl("telegram", id, origin), secret)
            } catch {
                await this.connections.patch(actor.workspaceId, id, {
                    status: "error",
                    lastError: ChannelConnectionsErrorCode.WebhookRefused,
                })
                throw new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.WebhookRefused })
            }
        }
        return { connection: await this.connections.get(actor.workspaceId, id), webhookRegistered: origin !== null }
    }

    /**
     * Creates a bank or payment feed as PENDING so its webhook address (and, for SePay, a freshly generated API key) exist for
     * the "follow along on the provider" step. SePay: the key hash verifies calls and the key itself is sealed for re-display.
     * payOS and Casso: the provider issues the keys; they are pasted in later (saveProviderKeys), so the secret starts empty.
     */
    async startMoneyConnection(actor: ConnectionActor, input: StartMoneyInput): Promise<WizardConnection> {
        await this.connections.authorize(actor, OWNER)
        if (!isMoneyProvider(input.provider)) {
            throw new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.ProviderUnsupported })
        }
        const rules = moneyRules(input.provider)
        const environment = chooseEnvironment(rules, input.environment, "live")
        const name = this.requireName(input.name)
        const meta: Record<string, string> = {}
        if (rules.needsBank) {
            const account = squeeze(input.accountNumber)
            if (!isAccountNumber(account)) {
                throw new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.AccountInvalid })
            }
            const bankCode = clean(input.bankCode, 20).toUpperCase()
            const holder = clean(input.holder, 80).toUpperCase()
            if (!bankCode || !holder) {
                throw new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.BankFieldsMissing })
            }
            Object.assign(meta, { bank_code: bankCode, account_masked: maskAccount(account), account_holder: holder })
        }
        const apiKey = input.provider === "sepay" ? `nivo_${randomSecret()}` : ""
        const id = await this.connections.create({
            workspaceId: actor.workspaceId,
            createdBy: actor.principalId,
            provider: input.provider,
            name,
            status: "pending",
            environment,
            meta,
            secret: {
                plain: apiKey || EMPTY_CREDENTIAL,
                webhookSecret: apiKey ? sha256(apiKey) : randomSecret(),
            },
        })
        return this.wizardView(await this.connections.get(actor.workspaceId, id), apiKey, false)
    }

    /**
     * Edits a bank or payment feed after it was created: environment, name, bank account and, for SePay, the API key (NIVO's
     * generated one or one the owner typed into SePay). A blank account number keeps the stored one.
     */
    async updateMoneyConnection(
        actor: ConnectionActor,
        connectionId: string,
        input: UpdateMoneyInput,
    ): Promise<WizardConnection> {
        await this.connections.authorize(actor, OWNER)
        const current = await this.connections.get(actor.workspaceId, connectionId)
        if (!isMoneyProvider(current.provider)) {
            throw new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.ProviderUnsupported })
        }
        const rules = moneyRules(current.provider)
        const environment = chooseEnvironment(rules, input.environment, current.environment)
        const name = this.requireName(input.name)
        const meta: Record<string, string> = { ...current.meta }
        if (rules.needsBank) {
            const bankCode = clean(input.bankCode, 20).toUpperCase()
            const holder = clean(input.holder, 80).toUpperCase()
            if (!bankCode || !holder) {
                throw new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.BankFieldsMissing })
            }
            const account = squeeze(input.accountNumber)
            if (account && !isAccountNumber(account)) {
                throw new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.AccountInvalid })
            }
            Object.assign(
                meta,
                { bank_code: bankCode, account_holder: holder },
                account ? { account_masked: maskAccount(account) } : {},
            )
        }
        let apiKey = ""
        if (current.provider === "sepay") {
            const stored = (await this.connections.readSecret(current.id))?.plain ?? ""
            apiKey = (input.apiKey ?? stored).trim()
            if (!isSepayKey(apiKey)) {
                throw new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.ApiKeyInvalid })
            }
            if (apiKey !== stored) await this.connections.writeSecret(current.id, apiKey, sha256(apiKey))
        }
        await this.connections.patch(actor.workspaceId, current.id, { name, environment, meta })
        return this.wizardView(await this.connections.get(actor.workspaceId, current.id), apiKey, false)
    }

    /** Continues an unfinished connection: SePay shows its key again; payOS and Casso keys are never returned. */
    async resumeConnection(actor: ConnectionActor, connectionId: string): Promise<WizardConnection> {
        await this.connections.authorize(actor, OWNER)
        const connection = await this.connections.get(actor.workspaceId, connectionId)
        const plain = (await this.connections.readSecret(connection.id))?.plain
        const apiKey = connection.provider === "sepay" ? (plain ?? "") : ""
        const saved = plain !== undefined && connection.provider !== "sepay" && plain !== EMPTY_CREDENTIAL
        return this.wizardView(connection, apiKey, saved)
    }

    /** Shows the SePay API key again (owner only) so it can be pasted into the SePay webhook settings. */
    async revealSepayKey(
        actor: ConnectionActor,
        connectionId: string,
    ): Promise<{ readonly apiKey: string; readonly webhookUrl: string }> {
        await this.connections.authorize(actor, OWNER)
        const connection = await this.ownOf(actor, connectionId, "sepay")
        const secret = await this.connections.readSecret(connection.id)
        if (secret === null) throw this.notFound(connection.id)
        return { apiKey: secret.plain, webhookUrl: this.connections.webhookUrl("sepay", connection.id) }
    }

    /**
     * payOS / Casso: stores the keys the owner copied from the provider (sealed). payOS is then asked to confirm the webhook
     * address itself; that call needs a public https address, so on a local site it is skipped.
     */
    async saveProviderKeys(
        actor: ConnectionActor,
        connectionId: string,
        values: Readonly<Record<string, string>>,
    ): Promise<ProviderKeysResult> {
        await this.connections.authorize(actor, OWNER)
        const connection = await this.connections.get(actor.workspaceId, connectionId)
        const fields = isMoneyProvider(connection.provider) ? moneyRules(connection.provider).credentials : []
        if (fields.length === 0) throw this.notFound(connection.id)
        const stored: Record<string, string> = {}
        for (const field of fields) {
            const value = (values[field] ?? "").trim()
            if (value.length < KEY_MIN || value.length > KEY_MAX) {
                throw new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.KeysInvalid })
            }
            stored[field] = value
        }
        await this.connections.writeSecret(connection.id, JSON.stringify(stored))
        const origin = this.connections.publicOrigin()
        let confirmed = false
        if (connection.provider === "payos" && origin !== null) {
            try {
                await this.setup.payosConfirmWebhook(
                    { clientId: stored.clientId as string, apiKey: stored.apiKey as string },
                    this.connections.webhookUrl("payos", connection.id, origin),
                )
            } catch {
                throw new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.PayosConfirmRefused })
            }
            confirmed = true
        }
        return { confirmed, localOnly: origin === null }
    }

    /** Asks what the provider knows (Telegram: getMe + getWebhookInfo; Zalo: the stored tokens), and records the verdict on the connection. */
    async check(actor: ConnectionActor, connectionId: string): Promise<ConnectionCheck> {
        await this.connections.authorize(actor, MANAGER)
        const connection = await this.connections.get(actor.workspaceId, connectionId)
        if (connection.status === "disconnected") throw this.notFound(connection.id)
        const localOnly = this.connections.publicOrigin() === null
        if (connection.provider === "zalo_oa") return this.checkZalo(actor, connection, localOnly)
        if (connection.provider !== "telegram") {
            return { provider: connection.provider, webhookOk: false, localOnly, pending: 0, lastError: null }
        }
        return this.checkTelegram(actor, connection, localOnly)
    }

    /** Takes a disconnecting connection off its provider (best effort): a Telegram bot stops sending to the webhook. */
    async release(connection: ConnectionRecord): Promise<void> {
        if (connection.provider !== "telegram" || this.connections.publicOrigin() === null) return
        const secret = await this.connections.readSecret(connection.id)
        if (secret === null) return
        await this.setup.telegramDeleteWebhook(secret.plain).catch(() => undefined)
    }

    /** What the wizard polls for: has the first webhook arrived. */
    firstEvent(actor: ConnectionActor, connectionId: string): Promise<FirstEventState> {
        return this.connections.firstEvent(actor, connectionId)
    }

    private async checkZalo(
        actor: ConnectionActor,
        connection: ConnectionRecord,
        localOnly: boolean,
    ): Promise<ConnectionCheck> {
        // The tokens are the thing that can silently die: a refresh token that is gone or expired needs a new authorization.
        const secret = await this.zaloSecretOf(connection.id)
        if (!hasLiveTokens(secret, this.clock.now().getTime())) {
            await this.connections.patch(actor.workspaceId, connection.id, {
                status: "error",
                lastError: ChannelConnectionsErrorCode.ZaloTokenRefused,
            })
            throw new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.ZaloTokenRefused })
        }
        await this.connections.patch(actor.workspaceId, connection.id, {
            ...(connection.status === "error" ? { status: "connected" as const } : {}),
            lastError: null,
        })
        return { provider: connection.provider, webhookOk: true, localOnly, pending: 0, lastError: null }
    }

    private async checkTelegram(
        actor: ConnectionActor,
        connection: ConnectionRecord,
        localOnly: boolean,
    ): Promise<ConnectionCheck> {
        const secret = await this.connections.readSecret(connection.id)
        if (secret === null) throw this.notFound(connection.id)
        let info
        try {
            await this.setup.telegramGetMe(secret.plain)
            info = await this.setup.telegramWebhookInfo(secret.plain)
        } catch (error) {
            const failure = this.mapSetup(error)
            await this.connections.patch(actor.workspaceId, connection.id, { status: "error", lastError: failure.code })
            throw failure
        }
        const origin = this.connections.publicOrigin()
        const webhookOk = origin !== null && info.url === this.connections.webhookUrl("telegram", connection.id, origin)
        const lastError = info.lastErrorMessage
        const healthy = origin === null || (webhookOk && !lastError)
        await this.connections.patch(actor.workspaceId, connection.id, {
            status: healthy ? "connected" : "error",
            lastError: origin === null ? null : lastError,
        })
        return { provider: connection.provider, webhookOk, localOnly, pending: info.pendingUpdateCount, lastError }
    }

    private requireName(name: string): string {
        const cleaned = cleanConnectionName(name)
        if (cleaned === null) throw new ConnectionsError({ code: ConnectionsErrorCode.NameInvalid })
        return cleaned
    }

    private notFound(id: string): ConnectionsError {
        return new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id } })
    }

    /** The workspace's connection when it is of the given provider; otherwise a typed not-found. */
    private async ownOf(actor: ConnectionActor, id: string, provider: Provider): Promise<ConnectionRecord> {
        const connection = await this.connections.get(actor.workspaceId, id)
        if (connection.provider !== provider) throw this.notFound(id)
        return connection
    }

    private async zaloSecretOf(connectionId: string): Promise<ZaloSecret> {
        const sealed = await this.connections.readSecret(connectionId)
        const secret = sealed === null ? null : parseZaloSecret(sealed.plain)
        if (secret === null) throw this.notFound(connectionId)
        return secret
    }

    private async wizardView(
        connection: ConnectionRecord,
        apiKey: string,
        credentialsSaved: boolean,
    ): Promise<WizardConnection> {
        return {
            id: connection.id,
            provider: connection.provider,
            name: connection.name,
            environment: connection.environment,
            status: connection.status,
            webhookUrl: this.connections.webhookUrl(connection.provider, connection.id),
            apiKey,
            bankCode: connection.meta.bank_code ?? "",
            account: connection.meta.account_masked ?? "",
            holder: connection.meta.account_holder ?? "",
            credentialsSaved,
            firstEvent: connection.firstEvent,
            agentIds: await this.connections.agentIds(connection.workspaceId, connection.id),
        }
    }

    /** Runs a provider call and turns a setup failure into the capability's own typed error. */
    private async viaSetup<T>(call: () => Promise<T>): Promise<T> {
        try {
            return await call()
        } catch (error) {
            throw this.mapSetup(error)
        }
    }

    private mapSetup(error: unknown): ChannelConnectionsError {
        if (error instanceof ChannelSetupError) {
            if (error.code === ChannelSetupErrorCode.CredentialRejected) {
                return new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.TokenRejected, cause: error })
            }
            if (error.code === ChannelSetupErrorCode.Unreachable) {
                return new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.Network, cause: error })
            }
        }
        return new ChannelConnectionsError({ code: ChannelConnectionsErrorCode.Failed, cause: error })
    }
}
