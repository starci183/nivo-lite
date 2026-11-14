import type { RetryTuning } from "./links/retry"
import type { TimeoutTuning } from "./links/timeout"

/** What an app tells the transport about itself so a no-auth client can be built: the same for every operation the app runs. */
export interface NoAuthTransport {
    /** The transport tuning of the retry and timeout links. */
    readonly tuning: RetryTuning & TimeoutTuning
    /** The URI of the GraphQL endpoint (read when a client is built, so the config owner stays the one reader of the environment). */
    readonly uri: () => string
    /** The name of the cookie that holds the reader locale. */
    readonly localeCookieName: string
    /** Ends the browser session of the app once the back end refuses it. */
    readonly endSession: () => Promise<unknown>
    /** The sign-in page of the app. */
    readonly signInUrl: () => string
}

/** What an app tells the transport about itself so an authenticated client can be built. */
export interface AuthTransport extends NoAuthTransport {
    /** Where the access token comes from: the app's session token. */
    readonly getToken: () => Promise<string | undefined>
    /** Refreshes the session and answers the new token. */
    readonly refresh: () => Promise<string | undefined>
    /** The workspace the address has open; present when the app sends `X-Workspace-Id`. */
    readonly workspaceId?: (() => string | undefined) | undefined
    /** The fixtures of a prototype build; present when the app has one. */
    readonly fixture?:
        | {
              /** True while the app runs as a prototype: operations are answered from the fixtures, not the network. */
              readonly active: () => boolean
              /** The data the fixtures give an operation by name, or null when there is none. */
              readonly answer: (operationName: string, variables: Readonly<Record<string, unknown>>) => Record<string, unknown> | null
          }
        | undefined
}
