import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { LeadBoardQuery, LeadBoardQueryVariables } from "../__generated__/graphql"

/** Generated response of the leadBoard query. */
type QueryLeadBoardResponse = LeadBoardQuery

type QueryLeadBoardRequest = WireInput<NonNullable<LeadBoardQueryVariables["input"]>>

type Document = TypedDocumentNode<QueryLeadBoardResponse, InputVariables<QueryLeadBoardRequest>>

const query1: Document = gql`
    query LeadBoard($input: LeadBoardInput!) {
        leadBoard(input: $input) {
            pageInfo {
                endCursor
                hasNextPage
            }
            nodes {
                channel
                company
                contactName
                contextSummary
                createdAt
                id
                installationId
                need
                nextAction
                ownerName
                stage
            }
        }
    }
`

enum QueryLeadBoard {
    Query1 = "query1",
}

const queryMap: Record<QueryLeadBoard, Document> = {
    [QueryLeadBoard.Query1]: query1,
}

/** Apollo parameters for the leadBoard query. */
type QueryLeadBoardParams = QueryParams<QueryLeadBoard, QueryLeadBoardRequest>

/** Runs the workspace-scoped leadBoard query through the authenticated GraphQL client. */
export const queryLeadBoard = async ({
    query = QueryLeadBoard.Query1,
    request = {},
    signal,
    headers,
}: QueryLeadBoardParams = {}) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        context: { headers },
        fetchPolicy: "no-cache",
    })
}
