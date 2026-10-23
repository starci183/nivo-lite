import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client"
import type { GraphQLHeaders } from "../../types"
import {
    createAttachAccessTokenLink,
    createAttachLocaleLink,
    createAttachWorkspaceIdLink,
    createErrorLink,
    createHttpLink,
    createRefreshOnUnauthenticatedLink,
    createRetryLink,
    createTimeoutLink,
    defaultOptions,
} from "../links"

/**
 * Authenticated Apollo client for GraphQL operations.
 *
 * Link order (`ApolloLink.from`: first = outermost, `HttpLink` is terminal):
 *
 * ```text
 *   1. RetryLink               retries transient network failures (backoff + jitter)
 *   2. ErrorLink               logs GraphQL / protocol / network errors
 *   3. TimeoutLink             fails an operation that does not answer within the window
 *   4. RefreshOnUnauth.Link    on an `unauthenticated` answer: supabase.auth.refreshSession, then retry once
 *   5. AttachAccessTokenLink   Authorization: Bearer <Supabase session access token>
 *   6. AttachWorkspaceIdLink   X-Workspace-Id (active workspace)
 *   6b. AttachLocaleLink       Accept-Language (locale cookie)
 *   7. HttpLink                POST to the back end /graphql
 * ```
 */
export interface CreateAuthApolloClientOptions {
    /** `false` keeps the Apollo defaults instead of {@link defaultOptions}. */
    cache?: boolean
    /** Additional static headers for the HttpLink. */
    headers?: GraphQLHeaders | undefined
    /** Optional abort signal for every operation on this client. */
    signal?: AbortSignal | undefined
    /** The URI of the GraphQL endpoint; defaults to the back end api. */
    uri?: string
}

/** Builds the authenticated Apollo client (bearer token, refresh, workspace and locale headers). */
export const createAuthApolloClient = ({
    cache = true,
    headers = {},
    signal,
    uri,
}: CreateAuthApolloClientOptions = {}) =>
    new ApolloClient({
        link: ApolloLink.from([
            createRetryLink(),
            createErrorLink(),
            createTimeoutLink(),
            createRefreshOnUnauthenticatedLink(),
            createAttachAccessTokenLink(),
            createAttachWorkspaceIdLink(),
            createAttachLocaleLink(),
            createHttpLink({ uri, headers, signal }),
        ]),
        cache: new InMemoryCache(),
        ...(cache ? { defaultOptions } : {}),
    })
