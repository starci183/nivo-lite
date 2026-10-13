import { HttpLink } from "@apollo/client"
import { graphqlUrl } from "@/modules/config"
import type { GraphQLHeaders } from "../../types"

/** Keeps the static headers that carry a value. */
const definedHeaders = (headers: GraphQLHeaders): Record<string, string> => {
    const kept: Record<string, string> = {}
    for (const [name, value] of Object.entries(headers)) {
        if (value !== undefined) kept[name] = value
    }
    return kept
}

/** Parameters of the terminal HTTP link. */
export interface CreateHttpLinkParams {
    /** Extra static headers merged into each request. */
    headers?: GraphQLHeaders
    /** The URI of the GraphQL endpoint; defaults to the back end api. */
    uri?: string
    /** Optional abort signal for every operation of the client, merged into `fetchOptions`. */
    signal?: AbortSignal
}

/**
 * Terminal link: the HTTP transport to the back end GraphQL endpoint. Requests are cross-origin with a bearer token, so no
 * cookies are sent.
 *
 * @see {@link https://www.apollographql.com/docs/react/api/link/apollo-link-http | HttpLink API}
 */
export const createHttpLink = ({ headers = {}, uri, signal }: CreateHttpLinkParams = {}) =>
    new HttpLink({
        uri: uri ?? graphqlUrl(),
        credentials: "omit",
        headers: definedHeaders(headers),
        fetchOptions: { signal },
    })
