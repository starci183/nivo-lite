import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client"
import type { GraphQLHeaders } from "../wire"
import { createEndSessionLink } from "./links/end-session"
import { createHttpLink } from "./links/http"
import { createAttachLocaleLink } from "./links/locale"
import { createRetryLink } from "./links/retry"
import { createTimeoutLink } from "./links/timeout"
import { defaultOptions } from "./options"
import type { NoAuthTransport } from "./transport"

/** Options of the no-auth client. */
export interface CreateNoAuthApolloClientOptions {
    /** The URI of the GraphQL endpoint; defaults to the app's back end api. */
    uri?: string
    /** `false` keeps the Apollo defaults instead of {@link defaultOptions}. */
    cache?: boolean
    /** Additional static headers for the HttpLink. */
    headers?: GraphQLHeaders | undefined
    /** Optional abort signal for every operation on this client. */
    signal?: AbortSignal | undefined
}

/**
 * Builds the Apollo client for operations that run without a session (sign-in, public reads): no token, no refresh.
 *
 * @param transport - What the app tells the transport about itself (tuning, endpoint, locale cookie, session end).
 * @param options - The per-operation options.
 * @returns A new client; the caller owns it for one operation.
 */
export const createNoAuthApolloClient = (
    transport: NoAuthTransport,
    { uri, cache = true, headers = {}, signal }: CreateNoAuthApolloClientOptions = {},
): ApolloClient =>
    new ApolloClient({
        link: ApolloLink.from([
            createRetryLink(transport.tuning),
            createEndSessionLink(transport),
            createTimeoutLink(transport.tuning),
            createAttachLocaleLink({ localeCookieName: transport.localeCookieName }),
            createHttpLink({ uri: uri ?? transport.uri(), headers, signal }),
        ]),
        cache: new InMemoryCache(),
        ...(cache ? { defaultOptions } : {}),
    })
