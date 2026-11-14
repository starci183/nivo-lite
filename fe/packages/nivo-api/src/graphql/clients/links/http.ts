import { HttpLink } from "@apollo/client"
import type { GraphQLHeaders } from "../../wire"

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
    /** The URI of the GraphQL endpoint. */
    uri: string
    /** Extra static headers merged into each request. */
    headers?: GraphQLHeaders | undefined
    /** Optional abort signal for every operation of the client, merged into `fetchOptions`. */
    signal?: AbortSignal | undefined
}

/**
 * Terminal link: the HTTP transport to the back end GraphQL endpoint. Requests are cross-origin with a bearer token, so no
 * cookies are sent.
 *
 * @see {@link https://www.apollographql.com/docs/react/api/link/apollo-link-http | HttpLink API}
 */
export const createHttpLink = ({ uri, headers = {}, signal }: CreateHttpLinkParams): HttpLink =>
    new HttpLink({
        uri,
        credentials: "omit",
        headers: definedHeaders(headers),
        fetchOptions: { signal: signal ?? null },
    })
