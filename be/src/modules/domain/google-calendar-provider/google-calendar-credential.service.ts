import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import { GoogleTokensService } from "@modules/domain/google-connections"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { GoogleCalendarError, GoogleCalendarErrorCode } from "@modules/integrations/google-calendar"
import { GOOGLE_CALENDAR_PROVIDER } from "./google-calendar-failure.policy"
import { DomainError } from "@modules/platform/errors"

/** The public fact of a Google connection that says its owner consented to the Calendar scopes (set by the grant flow, like `sheets: granted`). */
export const CALENDAR_GRANT_FACT = "calendar"

/** The value of that fact once consented. */
export const CALENDAR_GRANTED = "granted"

/** True when a failure is the access token being refused (401), so one forced refresh is worth a retry. */
const tokenRefused = (cause: unknown): boolean =>
    cause instanceof GoogleCalendarError && cause.code === GoogleCalendarErrorCode.AuthFailed && cause.params.status === 401

@Injectable()
/**
 * The access token of one Google account for Calendar, through the Google token store the Sheets, Drive and YouTube grants share (a stored
 * token while good, else refreshed). An account of another provider, or one whose owner did not consent to the Calendar scopes, sends
 * nothing (`no_credential`, proved `not_sent`); a token that cannot be had (a revoked grant) is proved `not_sent` too: no request has left.
 */
export class GoogleCalendarCredentialService {
    constructor(private readonly tokens: GoogleTokensService) {}

    /** Runs `work` with the account's token; one retry with a forced fresh token when Calendar refused the first (401). */
    withToken<T>(connection: ConnectionRecord, work: (token: string) => Promise<T>): Promise<T> {
        const provider: string = connection.provider
        if (provider !== GOOGLE_CALENDAR_PROVIDER || connection.meta[CALENDAR_GRANT_FACT] !== CALENDAR_GRANTED) {
            return Promise.reject(withProof(providerRefusal(GOOGLE_CALENDAR_PROVIDER, "no_credential"), "not_sent"))
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
