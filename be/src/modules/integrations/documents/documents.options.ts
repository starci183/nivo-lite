import type { Secret } from "@modules/platform/config"
import type { DocumentReaders } from "./documents.contracts"

/** The Google OAuth client the token refresh uses. */
export interface DocumentsGoogleClient {
    /** The client id. */
    readonly clientId: string
    /** The client secret. */
    readonly clientSecret: Secret
}

/** What reading documents needs from its environment. */
export interface DocumentsOptions {
    /** The base of the Drive v3 API, without a trailing slash. */
    readonly driveBase: string
    /** The base replacing accounts.google.com and oauth2.googleapis.com (a local fake), without a trailing slash; null for Google. */
    readonly oauthBase: string | null
    /** The Google OAuth client; null when the deployment has none (an expired Drive token then cannot be refreshed). */
    readonly google: DocumentsGoogleClient | null
    /** The readers of Word and PDF files. */
    readonly readers: DocumentReaders
}
