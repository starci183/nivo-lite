import { Injectable } from "@nestjs/common"
import type { Request, Response } from "express"
import { cookieValue } from "@modules/integrations/passport"
import type { DeviceMeta, SessionTokens } from "./identity-auth.contracts"
import { InjectIdentityAuthOptions } from "./identity-auth.decorators"
import type { IdentityAuthOptions } from "./identity-auth.options"

/** The name of the refresh cookie. */
const REFRESH_COOKIE = "nivo_refresh"
/** The only path the refresh cookie is sent to. */
const REFRESH_PATH = "/auth"
const MAX_AGENT_LENGTH = 512
const MILLISECONDS = 1000

@Injectable()
/**
 * The refresh cookie: httpOnly, Secure and SameSite=Lax, on the configured domain so the web app and the API both see it. The token
 * only ever leaves the back end through this cookie, never in a body or a URL.
 */
export class IdentityRefreshCookieService {
    constructor(@InjectIdentityAuthOptions() private readonly options: IdentityAuthOptions) {}

    /** The refresh token the browser sent (empty text when there is none). */
    read(request: Request): string {
        return cookieValue(request.headers.cookie ?? "", REFRESH_COOKIE)
    }

    /** The device a request comes from: its user agent (bounded) and caller address. */
    deviceOf(request: Request): DeviceMeta {
        return { userAgent: request.headers["user-agent"]?.slice(0, MAX_AGENT_LENGTH) ?? null, ip: request.ip ?? null }
    }

    /** Sets the cookie to the refresh token of a session. */
    issue(response: Response, tokens: SessionTokens): void {
        response.cookie(REFRESH_COOKIE, tokens.cookieToken, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: REFRESH_PATH,
            maxAge: tokens.refreshMaxAgeSeconds * MILLISECONDS,
            ...(this.options.cookieDomain === undefined ? {} : { domain: this.options.cookieDomain }),
        })
    }

    /** Clears the cookie. */
    clear(response: Response): void {
        response.clearCookie(REFRESH_COOKIE, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: REFRESH_PATH,
            ...(this.options.cookieDomain === undefined ? {} : { domain: this.options.cookieDomain }),
        })
    }
}
