import { Injectable } from "@nestjs/common"
import type { CookieOptions, Request, Response } from "express"
import { cookieValue } from "@modules/integrations/passport"
import type { DeviceMeta, SessionTokens } from "./identity-auth.contracts"
import { InjectIdentityAuthOptions } from "./identity-auth.decorators"
import type { IdentityAuthOptions } from "./identity-auth.options"

/** The name of the refresh cookie. */
const REFRESH_COOKIE = "nivo_refresh"
/** The refresh cookie is sent on every path: the web app's server reads it on its own pages and forwards it to the api. */
const REFRESH_PATH = "/"
/** The path older sessions wrote the cookie under; it is cleared so a stale copy never shadows the live one on /auth. */
const LEGACY_PATH = "/auth"
/** The flags every write and clear of the refresh cookie carries: no page script, HTTPS only, not sent on cross-site requests. */
const REFRESH_COOKIE_FLAGS = { httpOnly: true, secure: true, sameSite: "lax" } as const
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

    /** Sets the cookie to the refresh token of a session, clearing the copy older sessions kept under /auth. */
    issue(response: Response, tokens: SessionTokens): void {
        response.clearCookie(REFRESH_COOKIE, { ...REFRESH_COOKIE_FLAGS, path: LEGACY_PATH, ...this.domain() })
        response.cookie(REFRESH_COOKIE, tokens.cookieToken, {
            ...REFRESH_COOKIE_FLAGS,
            path: REFRESH_PATH,
            maxAge: tokens.refreshMaxAgeSeconds * MILLISECONDS,
            ...this.domain(),
        })
    }

    /** Clears the cookie on its path and on the path older sessions used. */
    clear(response: Response): void {
        response.clearCookie(REFRESH_COOKIE, { ...REFRESH_COOKIE_FLAGS, path: REFRESH_PATH, ...this.domain() })
        response.clearCookie(REFRESH_COOKIE, { ...REFRESH_COOKIE_FLAGS, path: LEGACY_PATH, ...this.domain() })
    }

    /** The configured cookie domain, or nothing so the cookie stays host-only. */
    private domain(): Pick<CookieOptions, "domain"> {
        return this.options.cookieDomain === undefined ? {} : { domain: this.options.cookieDomain }
    }
}
