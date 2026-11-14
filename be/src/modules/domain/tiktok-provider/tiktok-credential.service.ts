import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { InjectTiktok, type TiktokClient } from "@modules/integrations/tiktok"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { TIKTOK_PROVIDER } from "./tiktok-failure.policy"

/**
 * The members of a TikTok connection's sealed secret (`{ "accessToken": "…", "refreshToken": "…", "expiresAt": <epoch ms> }`). The
 * owner enters the two tokens of the TikTok user (scope `video.publish`) on the connection form; `expiresAt` is written by NIVO when it
 * refreshes (the access token lasts 2 hours, the refresh token 180 days: https://developers.tiktok.com/doc/oauth-user-access-token-management).
 */
export const TIKTOK_ACCESS_TOKEN = "accessToken"
export const TIKTOK_REFRESH_TOKEN = "refreshToken"
export const TIKTOK_EXPIRES_AT = "expiresAt"

/** The refresh happens this long before the access token expires. */
const REFRESH_MARGIN_MS = 90_000

/** The tokens of a sealed secret's plain text; whatever cannot be read answers nothing. */
export interface TiktokStoredTokens {
    /** The access token TikTok issued. */
    readonly accessToken?: string
    /** The refresh token TikTok issued. */
    readonly refreshToken?: string
    /** When the access token expires, as the connection stored it. */
    readonly expiresAt?: number
}

/** The stored tokens of a sealed secret. */
export const tiktokTokensOf = (plain: string): TiktokStoredTokens => {
    const read = parseJsonText(plain)
    if (!read.ok || !isRecord(read.value)) return {}
    const access = read.value[TIKTOK_ACCESS_TOKEN]
    const refresh = read.value[TIKTOK_REFRESH_TOKEN]
    const expires = read.value[TIKTOK_EXPIRES_AT]
    return {
        ...(typeof access === "string" && access.trim() !== "" ? { accessToken: access.trim() } : {}),
        ...(typeof refresh === "string" && refresh.trim() !== "" ? { refreshToken: refresh.trim() } : {}),
        ...(typeof expires === "number" && Number.isFinite(expires) ? { expiresAt: expires } : {}),
    }
}

@Injectable()
/**
 * The user access token of one TikTok account, opened from its sealed secret: the stored one while it is good (or when it names no expiry),
 * else refreshed through `/v2/oauth/token/` and sealed again (the refresh token rotates: the new one replaces the old). An account of another
 * provider or without a token sends nothing.
 */
export class TiktokCredentialService {
    constructor(
        private readonly connections: ConnectionsService,
        @InjectTiktok() private readonly client: TiktokClient,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** A usable access token; `force` refreshes first. `no_credential` / `auth_refused` (proved `not_sent`) when there is none to use. */
    async tokenOf(connection: ConnectionRecord, force: boolean): Promise<string> {
        const provider: string = connection.provider
        const secret = provider === TIKTOK_PROVIDER ? await this.connections.readSecret(connection.id) : null
        const stored = secret === null ? {} : tiktokTokensOf(secret.plain)
        if (stored.accessToken === undefined && stored.refreshToken === undefined) {
            throw withProof(providerRefusal(TIKTOK_PROVIDER, "no_credential"), "not_sent")
        }
        const expired = stored.expiresAt !== undefined && stored.expiresAt - REFRESH_MARGIN_MS <= this.clock.now().getTime()
        if (!force && stored.accessToken !== undefined && !expired) return stored.accessToken
        if (stored.refreshToken === undefined) throw withProof(providerRefusal(TIKTOK_PROVIDER, "auth_refused", "expired"), "not_sent")
        const next = await this.client.refresh(stored.refreshToken)
        await this.connections.writeSecret(
            connection.id,
            JSON.stringify({
                [TIKTOK_ACCESS_TOKEN]: next.accessToken,
                [TIKTOK_REFRESH_TOKEN]: next.refreshToken,
                [TIKTOK_EXPIRES_AT]: this.clock.now().getTime() + next.expiresInSeconds * 1000,
            }),
        )
        return next.accessToken
    }
}
