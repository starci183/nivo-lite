import { Injectable } from "@nestjs/common"
import { parseZaloSecret } from "@modules/domain/channel-connections"
import { ConnectionSecretsService, randomSecret, safeEqual } from "@modules/domain/connection-secrets"
import { ConnectionSecretReadsService, ConnectionsService } from "@modules/domain/connections"
import { InjectZalo, isZaloRefusal, newVerifier } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder, ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { isZaloAuthorizationPayload } from "@modules/queues/zalo-authorization"
import { isZaloRefreshPayload } from "@modules/queues/zalo-refresh"
import { InjectChannelsOptions } from "./channels.decorators"
import type {
    LoadedZalo,
    TokenWish,
    ZaloAuthorization,
    ZaloRefreshSummary,
    ZaloReturn,
    ZaloSecret,
} from "./channels.contracts"
import { ChannelsLogEvent } from "./channels.log-events"
import type { ChannelsConfig } from "./channels.options"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { ZALO_AUTHORIZATION_FAILED_REASON, ZALO_RECONNECT_REASON } from "./messages/channels.messages"

/** An access token with less than this left is renewed before use. */
const SKEW_MS = 5 * 60_000
/** How long one refresh holds the lease; a crashed worker frees it by this time. */
const LEASE_MS = 30_000
/** The refresh token lives 3 months. */
const REFRESH_TTL_MS = 90 * 86_400_000
/** A started authorization is good for 15 minutes. */
const AUTHORIZATION_TTL_MS = 15 * 60_000
/** The address Zalo returns the owner to, relative to the web origin. */
const CALLBACK_PATH = "/connections/zalo/callback"
/** Seven hours: a token that ends within this time is renewed when the tick carries no horizon of its own. */
const DEFAULT_WITHIN_MS = 7 * 3_600_000

@Injectable()
/**
 * The Zalo OA credential: the sealed JSON of App ID, App secret, OA secret key and tokens. A refresh token works once, so a refresh holds a short
 * database lease; a second caller finds the lease taken and either reads the winner's token or is told to try again shortly.
 */
export class ZaloCredentialsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectChannelsOptions() private readonly options: ChannelsConfig,
        @InjectZalo() private readonly zalo: ZaloClient,
        @InjectLogger() private readonly logger: Logger,
        private readonly secrets: ConnectionSecretsService,
        private readonly connections: ConnectionsService,
        private readonly secretReads: ConnectionSecretReadsService,
    ) {}

    /** The address to register on the Zalo app: Zalo sends the browser back here with code, oa_id and state. */
    callbackUrl(): string {
        return `${this.options.siteUrl}${CALLBACK_PATH}`
    }

    /** The credential of a connected Zalo connection, or a refusal when it is missing, disconnected or unreadable. */
    async load(connectionId: string): Promise<Outcome<LoadedZalo, ChannelsErrorCode>> {
        const found = await this.secretReads.secretOf(connectionId, "zalo_oa")
        if (found.kind !== "ok") return refused(ChannelsErrorCode.ConnectionNotFound)
        const secret = this.parse(found.value.credential)
        if (secret.kind !== "ok") return secret
        return ok({
            secret: secret.value,
            expiresAt: found.value.tokenExpiresAt === null ? null : Date.parse(found.value.tokenExpiresAt),
            workspaceId: found.value.workspaceId,
        })
    }

    /** Starts an authorization: stores the PKCE verifier with a one-time nonce and answers the permission page. */
    async beginAuthorization(workspaceId: string, connectionId: string): Promise<ZaloAuthorization> {
        const loaded = await this.requireOf(workspaceId, connectionId)
        const pkce = {
            verifier: newVerifier(),
            nonce: randomSecret(),
            exp: this.clock.now().getTime() + AUTHORIZATION_TTL_MS,
        }
        await this.save(connectionId, { ...loaded.secret, pkce })
        const callbackUrl = this.callbackUrl()
        return {
            url: this.zalo.authorizeUrl(
                loaded.secret.appId,
                callbackUrl,
                pkce.verifier,
                `${connectionId}.${pkce.nonce}`,
            ),
            callbackUrl,
        }
    }

    /** Finishes an authorization: the state must match the started one, then the code is exchanged and the tokens are stored. Answers the connection id. */
    async completeAuthorization(workspaceId: string, input: ZaloReturn): Promise<string> {
        const [connectionId = "", nonce = ""] = input.state.split(".")
        const loaded = await this.requireOf(workspaceId, connectionId)
        const pkce = loaded.secret.pkce
        if (pkce === undefined || !safeEqual(pkce.nonce, nonce)) {
            throw new ChannelsError({ code: ChannelsErrorCode.ZaloStateRejected })
        }
        if (this.clock.now().getTime() > pkce.exp) throw new ChannelsError({ code: ChannelsErrorCode.ZaloStateExpired })
        const tokens = await this.zalo.exchangeCode(
            loaded.secret.appId,
            loaded.secret.appSecret,
            input.code,
            pkce.verifier,
        )
        await this.save(connectionId, this.withTokens(loaded.secret, tokens.accessToken, tokens.renewalToken), {
            expiresAt: new Date(this.clock.now().getTime() + tokens.expiresInSeconds * 1000),
        })
        await this.connections.applyZaloAuthorization(connectionId, input.oaId)
        return connectionId
    }

    /**
     * Completes the authorization a queued job carries. The one-time code cannot be tried twice, so a state or a code that is refused marks the
     * connection failing for the owner to see and ends the job; any other failure is thrown for the queue to retry.
     */
    async completeFromJob(payload: unknown): Promise<void> {
        if (!isZaloAuthorizationPayload(payload)) return
        const { workspaceId, state, code, oaId } = payload
        await this.completeAuthorization(workspaceId, { state, code, ...(oaId === null ? {} : { oaId }) }).catch(
            async (cause: unknown) => {
                if (!(cause instanceof ChannelsError) && !isZaloRefusal(cause)) throw cause
                this.logger.error(ChannelsLogEvent.ZaloAuthorizationRefused, cause, {
                    connectionId: state.split(".")[0] ?? "",
                })
                await this.connections.markFailing(state.split(".")[0] ?? "", ZALO_AUTHORIZATION_FAILED_REASON)
            },
        )
    }

    /** Renews what the tick of a queued job asks for: its own horizon when the payload carries one, else seven hours. */
    refreshFromJob(payload: unknown): Promise<ZaloRefreshSummary> {
        return this.refreshDue(isZaloRefreshPayload(payload) ? payload.withinMs : DEFAULT_WITHIN_MS)
    }

    /** A working access token: the stored one while it has more than 5 minutes left, else renewed on use. */
    async accessToken(connectionId: string, wish: TokenWish = {}): Promise<string> {
        const current = await this.require(connectionId)
        const fresh = this.freshToken(current, wish)
        if (fresh !== undefined) return fresh
        if (current.secret.renewalToken === undefined)
            throw new ChannelsError({ code: ChannelsErrorCode.ZaloNotAuthorized })
        const now = this.clock.now()
        if (!(await this.secrets.takeLease(connectionId, new Date(now.getTime() + LEASE_MS), now))) {
            return this.afterLostLease(connectionId, wish)
        }
        return this.refreshUnderLease(connectionId, wish).catch(async (cause: unknown) => {
            await this.releaseLease(connectionId)
            throw cause
        })
    }

    /** Renews every Zalo connection whose access token ends within `withinMs`, which also keeps the 3-month refresh token rolling. */
    async refreshDue(withinMs: number): Promise<ZaloRefreshSummary> {
        const due = await this.secretReads.dueZalo(new Date(this.clock.now().getTime() + withinMs))
        let refreshed = 0
        let failed = 0
        await eachInOrder(due, async (connectionId) => {
            await this.accessToken(connectionId, { force: true }).then(
                () => {
                    refreshed += 1
                },
                (cause: unknown) => {
                    failed += 1
                    this.logger.error(ChannelsLogEvent.ZaloRefreshFailed, cause, { connectionId })
                },
            )
        })
        return { refreshed, failed }
    }

    private async save(
        connectionId: string,
        secret: ZaloSecret,
        options: { readonly expiresAt?: Date } = {},
    ): Promise<void> {
        await this.secrets.save(connectionId, this.secrets.seal(JSON.stringify(secret)), options.expiresAt)
    }

    private async refreshUnderLease(connectionId: string, wish: TokenWish): Promise<string> {
        // Another caller may have renewed between the first read and the lease: read again before spending the refresh token.
        const again = await this.require(connectionId)
        const fresh = this.freshToken(again, wish)
        if (fresh !== undefined) {
            await this.releaseLease(connectionId)
            return fresh
        }
        const renewalToken = again.secret.renewalToken
        if (renewalToken === undefined) throw new ChannelsError({ code: ChannelsErrorCode.ZaloNotAuthorized })
        const tokens = await this.zalo
            .refreshTokens(again.secret.appId, again.secret.appSecret, renewalToken)
            .catch(async (cause: unknown) => {
                // Zalo answered and said no: the refresh token is used up, expired or revoked. Only a new authorization fixes that.
                if (isZaloRefusal(cause)) await this.connections.markFailing(connectionId, ZALO_RECONNECT_REASON)
                throw cause
            })
        const next = this.withTokens(again.secret, tokens.accessToken, tokens.renewalToken)
        const expiresAt = new Date(this.clock.now().getTime() + tokens.expiresInSeconds * 1000)
        // The old refresh token is gone the moment Zalo answers: a failed save would lose the connection, so try twice.
        await this.save(connectionId, next, { expiresAt }).catch((cause: unknown) => {
            this.logger.error(ChannelsLogEvent.ZaloSaveRetried, cause, { connectionId })
            return this.save(connectionId, next, { expiresAt })
        })
        return tokens.accessToken
    }

    private async afterLostLease(connectionId: string, wish: TokenWish): Promise<string> {
        const settled = await this.require(connectionId)
        const fresh = wish.force === true ? undefined : this.freshToken(settled, wish)
        if (fresh === undefined) throw new ChannelsError({ code: ChannelsErrorCode.ZaloRefreshBusy })
        return fresh
    }

    private async releaseLease(connectionId: string): Promise<void> {
        await this.secrets.releaseLease(connectionId).catch((cause: unknown) => {
            this.logger.error(ChannelsLogEvent.LeaseNotReleased, cause, { connectionId })
        })
    }

    private freshToken(loaded: LoadedZalo, wish: TokenWish): string | undefined {
        const token = loaded.secret.accessToken
        const alive = loaded.expiresAt !== null && loaded.expiresAt - this.clock.now().getTime() > SKEW_MS
        if (token === undefined || !alive || wish.force === true) return undefined
        return wish.stale !== undefined && safeEqual(token, wish.stale) ? undefined : token
    }

    private withTokens(secret: ZaloSecret, accessToken: string, renewalToken: string): ZaloSecret {
        const { pkce: _started, ...rest } = secret
        return {
            ...rest,
            accessToken,
            renewalToken,
            refreshExpiresAt: new Date(this.clock.now().getTime() + REFRESH_TTL_MS).toISOString(),
        }
    }

    private async require(connectionId: string): Promise<LoadedZalo> {
        const loaded = await this.load(connectionId)
        if (loaded.kind !== "ok") throw new ChannelsError({ code: loaded.code })
        return loaded.value
    }

    private async requireOf(workspaceId: string, connectionId: string): Promise<LoadedZalo> {
        const loaded = await this.require(connectionId)
        if (loaded.workspaceId !== workspaceId) throw new ChannelsError({ code: ChannelsErrorCode.ConnectionNotFound })
        return loaded
    }

    private parse(credential: string): Outcome<ZaloSecret, ChannelsErrorCode> {
        const secret = parseZaloSecret(credential)
        // A wizard secret that has no OA secret key yet cannot sign or verify anything: it is not a usable credential.
        if (secret === null || secret.oaSecret === "") return refused(ChannelsErrorCode.SecretUnreadable)
        return ok(secret)
    }
}
