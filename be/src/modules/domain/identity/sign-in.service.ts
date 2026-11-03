import { Injectable } from "@nestjs/common"
import { InjectAuthDoors, InjectAuthSessions } from "@modules/integrations/passport"
import type {
    AccessGrant,
    AuthDoors,
    AuthSessions,
    GoogleRedirect,
    HttpExchange,
    JwksDocument,
} from "@modules/integrations/passport"
import type { Principal } from "@modules/platform/cqrs"
import { refusing } from "./auth-refusal.policy"

@Injectable()
/** The cookie doors of sign-in for the transport: the package's doors, with their refusals turned into the passport error family the errors filter maps. */
export class IdentitySignInService {
    constructor(
        @InjectAuthDoors() private readonly doors: AuthDoors,
        @InjectAuthSessions() private readonly sessions: AuthSessions,
    ) {}

    /** Email and password through the local strategy; the refresh token goes into the cookie. */
    login(exchange: HttpExchange): Promise<AccessGrant> {
        return refusing(() => this.doors.login(exchange))
    }

    /** Rotates the cookie token and answers a new access token; a cookie that cannot be used is cleared. */
    refresh(exchange: HttpExchange): Promise<AccessGrant> {
        return refusing(() => this.doors.refresh(exchange))
    }

    /** Answers a fresh access token for the cookie session without rotating the cookie. */
    session(exchange: HttpExchange): Promise<AccessGrant> {
        return refusing(() => this.doors.session(exchange))
    }

    /** Ends the session of the cookie and clears it. */
    logout(exchange: HttpExchange): Promise<void> {
        return refusing(() => this.doors.logout(exchange))
    }

    /** Sends the browser to the Google consent screen. */
    beginGoogle(exchange: HttpExchange): Promise<void> {
        return refusing(() => this.doors.beginGoogle(exchange))
    }

    /** Finishes the Google round trip; a failure redirects to the sign-in page instead of throwing. */
    completeGoogle(exchange: HttpExchange): Promise<GoogleRedirect> {
        return refusing(() => this.doors.completeGoogle(exchange))
    }

    /** The public key document access tokens verify against. */
    jwks(): Promise<JwksDocument> {
        return refusing(() => this.sessions.jwks())
    }

    /** Signs the person out of every other device; the session of the caller stays. */
    endOthers(principal: Principal): Promise<void> {
        return refusing(() => this.sessions.endOthers(principal.id, principal.sessionId))
    }
}
