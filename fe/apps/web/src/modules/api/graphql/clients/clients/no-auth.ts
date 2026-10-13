import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client"
import type { GraphQLHeaders } from "../../types"
import {
    createAttachLocaleLink,
    createErrorLink,
    createHttpLink,
    createRetryLink,
    createTimeoutLink,
    defaultOptions,
} from "../links"

/**
 * Anonymous (no-auth) Apollo client for the public doors of the back end (`@Public`): no token, no refresh.
 *
 * Link order: RetryLink, ErrorLink, TimeoutLink, AttachLocaleLink, HttpLink (terminal).
 */
export interface CreateNoAuthApolloClientOptions {
    /** The URI of the GraphQL endpoint; defaults to the back end api. */
    uri?: string
    /** `false` keeps the Apollo defaults instead of {@link defaultOptions}. */
    cache?: boolean
    /** Additional static headers for the HttpLink. */
    headers?: GraphQLHeaders
    /** Optional abort signal for every operation on this client. */
    signal?: AbortSignal
}

/** Builds the anonymous Apollo client for the public doors (locale header only). */
export const createNoAuthApolloClient = ({
    uri,
    cache = true,
    headers = {},
    signal,
}: CreateNoAuthApolloClientOptions = {}) =>
    new ApolloClient({
        link: ApolloLink.from([
            createRetryLink(),
            createErrorLink(),
            createTimeoutLink(),
            createAttachLocaleLink(),
            createHttpLink({ uri, headers, signal }),
        ]),
        cache: new InMemoryCache(),
        defaultOptions: cache ? defaultOptions : undefined,
    })
