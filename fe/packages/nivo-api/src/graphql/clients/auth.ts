import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client"
import type { GraphQLHeaders } from "../wire"
import { createAttachAccessTokenLink } from "./links/access-token"
import { createEndSessionLink } from "./links/end-session"
import { createFixtureLink } from "./links/fixture"
import { createHttpLink } from "./links/http"
import { createAttachLocaleLink } from "./links/locale"
import { createRefreshOnUnauthenticatedLink } from "./links/refresh"
import { createRetryLink } from "./links/retry"
import { createTimeoutLink } from "./links/timeout"
import { createAttachWorkspaceIdLink } from "./links/workspace"
import { defaultOptions } from "./options"
import type { AuthTransport } from "./transport"

/**
 * Options of the authenticated client.
 *
 * Link order (`ApolloLink.from`: first = outermost, `HttpLink` is terminal):
 *
 * ```text
 *   1. RetryLink               retries transient network failures (backoff + jitter)
 *   2. EndSessionLink          ends the session and goes to sign-in on a refusal no refresh fixes
 *   3. TimeoutLink             fails an operation that does not answer within the window
 *   4. RefreshOnUnauth.Link    on an `unauthenticated` answer: refresh the session, then retry once
 *   5. AttachAccessTokenLink   Authorization: Bearer <in-memory access token>
 *   6. AttachWorkspaceIdLink   X-Workspace-Id (active workspace; only when the app names one)
 *   6b. AttachLocaleLink       Accept-Language (locale cookie)
 *   7. HttpLink                POST to the back end /graphql (the fixture link in a prototype build)
 * ```
 */
export interface CreateAuthApolloClientOptions {
    /** `false` keeps the Apollo defaults instead of {@link defaultOptions}. */
    cache?: boolean
    /** Additional static headers for the HttpLink. */
    headers?: GraphQLHeaders | undefined
    /** Optional abort signal for every operation on this client. */
    signal?: AbortSignal | undefined
    /** The URI of the GraphQL endpoint; defaults to the app's back end api. */
    uri?: string
}

/**
 * Builds the authenticated Apollo client of an app.
 *
 * @param transport - What the app tells the transport about itself (tuning, endpoint, session, workspace, fixtures).
 * @param options - The per-operation options.
 * @returns A new client; the caller owns it for one operation.
 */
export const createAuthApolloClient = (
    transport: AuthTransport,
    { cache = true, headers = {}, signal, uri }: CreateAuthApolloClientOptions = {},
): ApolloClient =>
    new ApolloClient({
        link: ApolloLink.from([
            createRetryLink(transport.tuning),
            createEndSessionLink(transport),
            createTimeoutLink(transport.tuning),
            createRefreshOnUnauthenticatedLink({ refresh: transport.refresh }),
            createAttachAccessTokenLink({ getToken: transport.getToken }),
            ...(transport.workspaceId === undefined ? [] : [createAttachWorkspaceIdLink({ workspaceId: transport.workspaceId })]),
            createAttachLocaleLink({ localeCookieName: transport.localeCookieName }),
            transport.fixture?.active() === true
                ? createFixtureLink({ answer: transport.fixture.answer })
                : createHttpLink({ uri: uri ?? transport.uri(), headers, signal }),
        ]),
        cache: new InMemoryCache(),
        ...(cache ? { defaultOptions } : {}),
    })
