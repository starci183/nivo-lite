import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryTestOpenApiOperationArgs } from "../__generated__/schema"

/** The variables of the `testOpenApiOperation` query. */
export type QueryTestOpenApiOperationRequest = QueryTestOpenApiOperationArgs["input"]

/** The response of the `testOpenApiOperation` query. */
type QueryTestOpenApiOperationResponse = Pick<Query, "testOpenApiOperation">

const query1: TypedDocumentNode<QueryTestOpenApiOperationResponse, InputVariables<QueryTestOpenApiOperationRequest>> = gql`
    query TestOpenApiOperation($input: TestOpenApiOperationInput!) {
        testOpenApiOperation(input: $input) {
            status
            itemCount
            itemsPath
            idField
            titleField
            sampleKeys
            error
        }
    }
`

enum QueryTestOpenApiOperationKind {
    Query1 = "query1",
}

const queryMap: Record<QueryTestOpenApiOperationKind, TypedDocumentNode<QueryTestOpenApiOperationResponse, InputVariables<QueryTestOpenApiOperationRequest>>> = {
    [QueryTestOpenApiOperationKind.Query1]: query1,
}

/** Apollo params for {@link queryTestOpenApiOperation}. */
interface QueryTestOpenApiOperationParams extends QueryParams<QueryTestOpenApiOperationKind, QueryTestOpenApiOperationRequest> {
    request: QueryTestOpenApiOperationRequest
}

/** Tries one GET of an API with the typed settings. Rejects with the back end failure. */
export const queryTestOpenApiOperation = async ({ query = QueryTestOpenApiOperationKind.Query1, request, signal }: QueryTestOpenApiOperationParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
