import { Injectable } from "@nestjs/common"
import { ChannelsError, ChannelsErrorCode, ZaloCredentialsService } from "@modules/domain/channels"
import type { PollFailure } from "@modules/domain/connection-poll"
import type { ZaloAccessToken, ZaloAccessTokens } from "@modules/domain/zalo-provider"

/** The credential failures only the owner can mend by connecting again. */
const NEEDS_OWNER: ReadonlySet<ChannelsErrorCode> = new Set([
    ChannelsErrorCode.ZaloNotAuthorized,
    ChannelsErrorCode.SecretUnreadable,
])

@Injectable()
/**
 * The Zalo provider's access-token port, over the connection's credential keeper (`ZaloCredentialsService`, which refreshes the token with
 * its single-use refresh token): the app binds it, so the provider names no other capability. A connection without a usable credential, or
 * without a token yet, is skipped, not failed; a busy refresh is worth retrying and a refused credential needs the owner, as before.
 */
export class ZaloInboxTokensService implements ZaloAccessTokens {
    constructor(private readonly credentials: ZaloCredentialsService) {}

    /** The token of the connection, refreshed when it is due, or why there is none. */
    async tokenOf(connectionId: string): Promise<ZaloAccessToken> {
        const loaded = await this.credentials.load(connectionId)
        if (loaded.kind !== "ok") return { kind: "skipped", reason: "not_ready" }
        if (loaded.value.secret.accessToken === undefined) return { kind: "skipped", reason: "no_token" }
        return { kind: "token", token: await this.credentials.accessToken(connectionId) }
    }

    /** How a failure of the credential keeper reads for the poll; null for any other error. */
    failureOf(error: unknown): PollFailure | null {
        if (!(error instanceof ChannelsError)) return null
        if (error.code === ChannelsErrorCode.ZaloRefreshBusy) return { kind: "transient" }
        return NEEDS_OWNER.has(error.code) ? { kind: "auth_failed", reason: "credential" } : { kind: "fatal" }
    }
}
