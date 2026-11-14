import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import { GoogleTokensService } from "@modules/domain/google-connections"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { YoutubeError, YoutubeErrorCode } from "@modules/integrations/youtube"
import { YOUTUBE_PROVIDER } from "./youtube-failure.policy"
import { DomainError } from "@modules/platform/errors"

/** The public fact of a Google connection that says its owner consented to the YouTube scope (set by the grant flow, like `sheets: granted`). */
export const YOUTUBE_GRANT_FACT = "youtube"

/** The value of that fact once consented. */
export const YOUTUBE_GRANTED = "granted"

/** True when the refusal of a call is its access token being refused (401), so one forced refresh is worth a retry. */
const tokenRefused = (cause: unknown): boolean =>
    cause instanceof YoutubeError && cause.code === YoutubeErrorCode.AuthFailed && cause.params.status === 401

@Injectable()
/**
 * The access token of one Google account for YouTube, through the Google token store the Sheets and Drive grants share (a stored token
 * while good, else refreshed). An account of another provider, or one whose owner did not consent to the YouTube scope, sends nothing
 * (`no_credential`, proved `not_sent`); a token that cannot be had (a revoked grant) is proved `not_sent` too, since no YouTube request
 * has left.
 */
export class YoutubeCredentialService {
    constructor(private readonly tokens: GoogleTokensService) {}

    /** Runs `work` with the account's token; one retry with a forced fresh token when YouTube refused the first (401). */
    withToken<T>(connection: ConnectionRecord, work: (token: string) => Promise<T>): Promise<T> {
        const provider: string = connection.provider
        if (provider !== YOUTUBE_PROVIDER || connection.meta[YOUTUBE_GRANT_FACT] !== YOUTUBE_GRANTED) {
            return Promise.reject(withProof(providerRefusal(YOUTUBE_PROVIDER, "no_credential"), "not_sent"))
        }
        const token = async (force: boolean): Promise<string> => {
            try {
                return await this.tokens.accessToken({ row: connection, force })
            } catch (cause) {
                const failure = withProof(cause, "not_sent")
                if (failure instanceof DomainError) throw failure
                throw cause
            }
        }
        return this.tokens.withRetry(token, work, tokenRefused)
    }
}
