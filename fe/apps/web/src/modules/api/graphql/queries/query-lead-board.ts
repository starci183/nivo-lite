import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { LeadBoardQuery } from "../__generated__/graphql"

/** Generated response of the leadBoard query. */
type QueryLeadBoardResponse = LeadBoardQuery

type Document = TypedDocumentNode<QueryLeadBoardResponse>

const query1: Document = gql`
    query LeadBoard {
        leadBoard {
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
`

enum QueryLeadBoard {
    Query1 = "query1",
}

const queryMap: Record<QueryLeadBoard, Document> = {
    [QueryLeadBoard.Query1]: query1,
}

/** Apollo parameters for the leadBoard query. */
type QueryLeadBoardParams = QueryParams<QueryLeadBoard>

/** Runs the workspace-scoped leadBoard query through the authenticated GraphQL client. */
export const queryLeadBoard = async ({ query = QueryLeadBoard.Query1, signal, headers }: QueryLeadBoardParams = {}) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
