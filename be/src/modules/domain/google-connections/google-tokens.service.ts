import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import { randomSecret } from "@modules/domain/connection-secrets"
import { GoogleError, InjectGoogleClient, safeReturnTo } from "@modules/integrations/google"
import type { GoogleClient } from "@modules/integrations/google"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "./errors/google-connections.error"
import type {
    ConsentRequest,
    ConsentStart,
    MaybeConnection,
    MaybeRefreshToken,
    StoredGoogleTokens,
    TokenRejected,
    TokenRequest,
    TokenSave,
    TokenSource,
    TokenWork,
} from "./google-connections.contracts"
import { freshAccessToken, parseTokens } from "./policies/google-tokens.policy"

/** The reason Google gives for a revoked refresh token. */
export const INVALID_GRANT = "invalid_grant"

@Injectable()
/**
 * The Google token store shared by the Sheets connections and the Drive read grant: the consent url, the sealed tokens of a connection,
 * the lazy refresh shortly before expiry (a revoked refresh token marks the connection lost) and the one retry with a fresh token.
 */
export class GoogleTokensService {
    constructor(
        private readonly connections: ConnectionsService,
        @InjectGoogleClient() private readonly google: GoogleClient,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Signs the state and answers the Google consent url; refuses when Google is not configured on this deployment. */
    consent(request: ConsentRequest): ConsentStart {
        if (!this.google.isConfigured()) {
            throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.NotConfigured })
        }
        const state = this.google.sign({
            workspaceId: request.actor.workspaceId,
            userId: request.actor.principalId,
            returnTo: safeReturnTo(request.returnTo),
            ...(request.purpose === undefined ? {} : { purpose: request.purpose }),
        })
        const url = this.google.authUrl(state, request.scope)
        if (url === null) throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.StartFailed })
        return { url }
    }

    /** The stored tokens of a connection; nothing when there is no secret or it cannot be read. */
    private async stored(connectionId: string): Promise<Partial<StoredGoogleTokens>> {
        const sealed = await this.connections.readSecret(connectionId)
        return sealed === null ? {} : parseTokens(sealed.plain)
    }

    /** The refresh token to keep for a consent: the one Google just sent, else the one stored with the connection, else null. */
    async keptRefresh(row: MaybeConnection, incoming: MaybeRefreshToken): Promise<MaybeRefreshToken> {
        if (incoming) return incoming
        if (row === null) return null
        return (await this.stored(row.id)).refresh_token ?? null
    }

    /** Stores a consent: the existing connection is marked connected with fresh tokens, otherwise a new one is created. */
    async save(save: TokenSave): Promise<void> {
        const plain = JSON.stringify(save.tokens)
        if (save.row !== null) {
            await this.connections.patch(save.workspaceId, save.row.id, {
                name: save.name,
                status: "connected",
                lastError: null,
                meta: save.meta,
            })
            await this.connections.writeSecret(save.row.id, plain)
            return
        }
        await this.connections.create({
            workspaceId: save.workspaceId,
            createdBy: save.userId,
            provider: save.provider,
            name: save.name,
            status: "connected",
            environment: "live",
            meta: save.meta,
            secret: { plain, webhookSecret: randomSecret() },
        })
    }

    /**
     * A valid access token for a connection: the stored one while it is good, else refreshed and stored again sealed. Tokens that are
     * gone or a revoked refresh token (the connection is marked invalid_grant) throw GOOGLE_CONNECTIONS_LOST.
     */
    async accessToken(request: TokenRequest): Promise<string> {
        const { row } = request
        const stored = await this.stored(row.id)
        if (!stored.refresh_token) throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Lost })
        const fresh = request.force ? null : freshAccessToken(stored, this.clock.now().getTime())
        if (fresh !== null) return fresh
        try {
            const next = await this.google.refreshAccessToken(stored.refresh_token)
            const kept: StoredGoogleTokens = {
                access_token: next.accessToken,
                refresh_token: next.refreshToken ?? stored.refresh_token,
                expires_at: next.expiresAt,
            }
            await this.connections.writeSecret(row.id, JSON.stringify(kept))
            return next.accessToken
        } catch (error) {
            if (!(error instanceof GoogleError) || error.params.reason !== INVALID_GRANT) throw error
            await this.connections.patch(row.workspaceId, row.id, { status: "error", lastError: INVALID_GRANT })
            throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Lost, cause: error })
        }
    }

    /** Runs `work` with a token; one retry with a forced fresh token when the token was refused (`rejected`). */
    async withRetry<T>(token: TokenSource, work: TokenWork<T>, rejected: TokenRejected): Promise<T> {
        const first = await token(false)
        try {
            return await work(first)
        } catch (error) {
            if (!rejected(error)) throw error
            return work(await token(true))
        }
    }
}
