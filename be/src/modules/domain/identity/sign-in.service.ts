import { Injectable } from "@nestjs/common"
import { InjectPassportFlows } from "@modules/integrations/passport"
import type { HttpExchange, PassportFlowsService } from "@modules/integrations/passport"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AccessGrant, GoogleRedirect, SessionTokens } from "./identity-auth.contracts"
import { InjectIdentityAuthOptions } from "./identity-auth.decorators"
import { IdentityAuthLogEvent } from "./identity-auth.log-events"
import type { IdentityAuthOptions } from "./identity-auth.options"
import { IdentityRefreshCookieService } from "./refresh-cookie.service"
import { IdentitySessionsService } from "./sessions.service"

const SEE_OTHER = 303

const accessOf = (tokens: SessionTokens): AccessGrant => ({
    accessToken: tokens.accessToken,
    expiresIn: tokens.accessExpiresIn,
    expiresAt: tokens.accessExpiresAt,
    user: tokens.user,
})

@Injectable()
/** The cookie doors of sign-in: runs a strategy or reads the refresh cookie, opens or rotates the session and writes the cookie. */
export class IdentitySignInService {
    constructor(
        @InjectPassportFlows() private readonly flows: PassportFlowsService,
        private readonly sessions: IdentitySessionsService,
        private readonly cookies: IdentityRefreshCookieService,
        @InjectIdentityAuthOptions() private readonly options: IdentityAuthOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Email and password through the local strategy; the refresh token goes into the cookie. */
    async login(exchange: HttpExchange): Promise<AccessGrant> {
        const subject = await this.flows.authenticateLocal(exchange)
        const tokens = await this.sessions.start(subject, this.cookies.deviceOf(exchange.req))
        this.cookies.issue(exchange.res, tokens)
        return accessOf(tokens)
    }

    /** Rotates the cookie token and answers a new access token; a cookie that cannot be used is cleared, one a sibling just rotated is left as the sibling wrote it and the refusal rethrown. */
    async refresh(exchange: HttpExchange): Promise<AccessGrant> {
        try {
            const tokens = await this.sessions.refresh(this.cookies.read(exchange.req))
            if (tokens.cookieKept !== true) this.cookies.issue(exchange.res, tokens)
            return accessOf(tokens)
        } catch (cause) {
            this.cookies.clear(exchange.res)
            throw cause
        }
    }

    /** Answers a fresh access token for the cookie session without rotating the cookie. */
    async session(exchange: HttpExchange): Promise<AccessGrant> {
        return accessOf(await this.sessions.access(this.cookies.read(exchange.req)))
    }

    /** Ends the session of the cookie and clears it. */
    async logout(exchange: HttpExchange): Promise<void> {
        await this.sessions.end(this.cookies.read(exchange.req))
        this.cookies.clear(exchange.res)
    }

    /** Sends the browser to the Google consent screen. */
    beginGoogle(exchange: HttpExchange): Promise<void> {
        return this.flows.beginGoogle(exchange)
    }

    /**
     * Finishes the Google round trip: state, PKCE and profile are verified, the account found, linked or created, its session opened and
     * its cookie set. A failure never throws: the browser is sent back to the sign-in page, because a redirect-only door has nowhere to
     * show an error body.
     */
    async completeGoogle(exchange: HttpExchange): Promise<GoogleRedirect> {
        try {
            const completion = await this.flows.completeGoogle(exchange)
            const tokens = await this.sessions.start(completion.subject, this.cookies.deviceOf(exchange.req))
            this.cookies.issue(exchange.res, tokens)
            return { url: `${this.options.webOrigin}${completion.next}`, statusCode: SEE_OTHER }
        } catch (cause) {
            this.cookies.clear(exchange.res)
            this.logger.error(IdentityAuthLogEvent.GoogleSignInFailed, cause)
            return { url: `${this.options.webOrigin}/sign-in?auth=error`, statusCode: SEE_OTHER }
        }
    }
}
