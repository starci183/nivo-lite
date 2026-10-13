import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryLoadOpenApiSpecArgs } from "../__generated__/schema"

/** The variables of the `loadOpenApiSpec` query. */
export type QueryLoadOpenApiSpecRequest = QueryLoadOpenApiSpecArgs["input"]

/** The response of the `loadOpenApiSpec` query. */
type QueryLoadOpenApiSpecResponse = Pick<Query, "loadOpenApiSpec">

const query1: TypedDocumentNode<QueryLoadOpenApiSpecResponse, InputVariables<QueryLoadOpenApiSpecRequest>> = gql`
    query LoadOpenApiSpec($input: LoadOpenApiSpecInput!) {
        loadOpenApiSpec(input: $input) {
            title
            baseUrl
            specUrl
            ops
            authHint {
                type
                name
            }
        }
    }
`

enum QueryLoadOpenApiSpecKind {
    Query1 = "query1",
}

const queryMap: Record<QueryLoadOpenApiSpecKind, TypedDocumentNode<QueryLoadOpenApiSpecResponse, InputVariables<QueryLoadOpenApiSpecRequest>>> = {
    [QueryLoadOpenApiSpecKind.Query1]: query1,
}

/** Apollo params for {@link queryLoadOpenApiSpec}. */
interface QueryLoadOpenApiSpecParams extends QueryParams<QueryLoadOpenApiSpecKind, QueryLoadOpenApiSpecRequest> {
    request: QueryLoadOpenApiSpecRequest
}

/** Reads the operations of an API spec from a link or pasted text. Rejects with the back end failure. */
export const queryLoadOpenApiSpec = async ({ query = QueryLoadOpenApiSpecKind.Query1, request, signal }: QueryLoadOpenApiSpecParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
