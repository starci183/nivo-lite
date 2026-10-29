import type { Request, Response } from "express"

/** The person a sign-in method established; the domain turns it into a session. */
export interface AuthSubject {
    /** The `auth.users` id. */
    readonly userId: string
    /** The account email. */
    readonly email: string
}

/** What Google told us about the person who consented. */
export interface GoogleProfile {
    /** Google's stable account id (`sub`). */
    readonly subject: string
    /** The Google email, when released. */
    readonly email: string | null
    /** True when Google verified that mailbox. */
    readonly emailVerified: boolean
    /** The display name, when released. */
    readonly name: string | null
    /** The picture address, when released. */
    readonly picture: string | null
}

/** The sign-in decisions the domain makes for the two strategies; each throws the domain error when it refuses. */
export interface PassportAuthenticator {
    /** Verifies an email and password; answers the person or throws. */
    verifyPassword(email: string, password: string): Promise<AuthSubject>
    /** Finds, links or creates the person a verified Google profile stands for; answers the person or throws. */
    signInWithGoogle(profile: GoogleProfile): Promise<AuthSubject>
}

/** The claims of one of our access tokens after verification. */
export interface AccessClaims {
    /** The user id. */
    readonly sub: string
    /** The email at issue time, when the account has one. */
    readonly email?: string | undefined
    /** The device session the token belongs to. */
    readonly sessionId: string
}

/** A freshly signed access token. */
export interface IssuedAccessToken {
    /** The compact JWT. */
    readonly token: string
    /** When it stops being accepted. */
    readonly expiresAt: Date
}

/** The public key document served at `/auth/jwks`. */
export interface JwksDocument {
    /** The signing keys. */
    readonly keys: ReadonlyArray<Record<string, string>>
}

/** The short-lived state a Google round trip carries in its cookie. */
export interface GoogleRoundTrip {
    /** The handle echoed as the OAuth `state`. */
    readonly handle: string
    /** The PKCE code verifier. */
    readonly verifier: string
    /** The same-site path to land on after sign-in. */
    readonly next: string
}

/** The result of the Google callback leg. */
export interface GoogleCompletion {
    /** The signed-in person. */
    readonly subject: AuthSubject
    /** The same-site path the browser lands on. */
    readonly next: string
}

/** The two halves of an HTTP exchange the flows work on. */
export interface HttpExchange {
    /** The request. */
    readonly req: Request
    /** The response. */
    readonly res: Response
}
