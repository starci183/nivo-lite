import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

type QueryLeadBoardResponse = Pick<Query, "leadBoard">

const query1: TypedDocumentNode<QueryLeadBoardResponse, Record<string, never>> = gql`
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
            origin
            ownerName
            stage
        }
    }
`

enum QueryLeadBoard {
    Query1 = "query1",
}

const queryMap: Record<QueryLeadBoard, TypedDocumentNode<QueryLeadBoardResponse, Record<string, never>>> = {
    [QueryLeadBoard.Query1]: query1,
}

type QueryLeadBoardParams = QueryParams<QueryLeadBoard>

/** The back end `leadBoard` query. Rejects with the back end failure (message localized by the server). */
export const queryLeadBoard = async ({ query = QueryLeadBoard.Query1, signal }: QueryLeadBoardParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
