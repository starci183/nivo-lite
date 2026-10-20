import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { BrandProposalsQuery, BrandProposalsQueryVariables } from "../__generated__/graphql"

/** Generated input of the `brandProposals` query. */
type QueryBrandProposalsRequest = WireInput<BrandProposalsQueryVariables["input"]>

type Document = TypedDocumentNode<BrandProposalsQuery, InputVariables<QueryBrandProposalsRequest>>

const query1: Document = gql`
    query BrandProposals($input: BrandProposalsInput!) {
        brandProposals(input: $input) {
            id
            installationId
            setupSessionId
            fileName
            fileSize
            status
            decidedBy
            createdAt
            kit {
                brandName
                colors {
                    name
                    hex
                }
                fonts
                tone
                address
                imagery
                avoid
            }
        }
    }
`

enum QueryBrandProposals {
    Query1 = "query1",
}

const queryMap: Record<QueryBrandProposals, Document> = {
    [QueryBrandProposals.Query1]: query1,
}

/** Apollo options for the brand proposals of one agent instance. */
type QueryBrandProposalsParams = QueryParams<QueryBrandProposals, QueryBrandProposalsRequest> & {
    request: QueryBrandProposalsRequest
}

/** Reads the brand kits read from guideline PDFs of one agent instance, newest first. */
export const queryBrandProposals = async ({
    query = QueryBrandProposals.Query1,
    request,
    signal,
}: QueryBrandProposalsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "network-only" })
}
