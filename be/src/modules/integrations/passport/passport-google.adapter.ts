import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { Strategy } from "passport-google-oauth20"
import type { Profile } from "passport-google-oauth20"
import { PassportError, PassportErrorCode } from "./errors/passport.error"
import type { GoogleStateClient } from "./google-state.client"
import type { AuthSubject, GoogleProfile, PassportAuthenticator } from "./passport.contracts"
import { InjectGoogleState, InjectPassportAuthenticator, InjectPassportOptions } from "./passport.decorators"
import type { PassportOptions } from "./passport.options"

const verifiedOf = (profile: Profile): boolean => {
    const claim: unknown = profile._json.email_verified
    return claim === true || claim === "true"
}

/** The facts the domain needs from a Google profile; an account without a subject is refused. */
export const googleProfileOf = (profile: Profile): GoogleProfile => {
    if (profile.id === "") throw new PassportError({ code: PassportErrorCode.GoogleRejected })
    return {
        subject: profile.id,
        email: profile.emails?.[0]?.value ?? null,
        emailVerified: verifiedOf(profile),
        name: profile.displayName === "" ? null : profile.displayName,
        picture: profile.photos?.[0]?.value ?? null,
    }
}

@Injectable()
/** The Google OAuth 2.0 strategy: authorization code with `state` and PKCE (S256), the round trip held in a signed cookie. */
export class PassportGoogleStrategy extends PassportStrategy(Strategy, "google") {
    private readonly authenticator: PassportAuthenticator

    constructor(
        @InjectPassportOptions() options: PassportOptions,
        @InjectPassportAuthenticator() authenticator: PassportAuthenticator,
        @InjectGoogleState() state: GoogleStateClient,
    ) {
        if (options.google === null) throw new PassportError({ code: PassportErrorCode.GoogleUnavailable })
        super({
            clientID: options.google.clientId,
            clientSecret: options.google.clientSecret.reveal(),
            callbackURL: options.google.callbackUrl,
            scope: ["openid", "email", "profile"],
            state: true,
            pkce: true,
        })
        this.authenticator = authenticator
        // passport-oauth2 types describe only its session stores; the stateless PKCE store replaces the one it built.
        Object.assign(this, { _stateStore: state })
    }

    /** Called by passport with Google's profile; answers the person the domain stands it for. */
    validate(_accessToken: string, _refreshToken: string, profile: Profile): Promise<AuthSubject> {
        return this.authenticator.signInWithGoogle(googleProfileOf(profile))
    }
}
