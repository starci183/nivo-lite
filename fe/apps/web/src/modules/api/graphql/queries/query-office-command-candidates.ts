import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { OfficeCommandCandidatesQuery } from "../__generated__/graphql"

type QueryOfficeCommandCandidatesResponse = OfficeCommandCandidatesQuery

const query1: TypedDocumentNode<QueryOfficeCommandCandidatesResponse, Record<string, never>> = gql`
    query OfficeCommandCandidates {
        officeCommandCandidates {
            command
            created_at
            id
            message_id
            module
            payload
            refusal_detail
            shown {
                key
                label
                value
            }
            status
            summary
            work_item_id
        }
    }
`

enum QueryOfficeCommandCandidates {
    Query1 = "query1",
}

const queryMap: Record<
    QueryOfficeCommandCandidates,
    TypedDocumentNode<QueryOfficeCommandCandidatesResponse, Record<string, never>>
> = {
    [QueryOfficeCommandCandidates.Query1]: query1,
}

type QueryOfficeCommandCandidatesParams = QueryParams<QueryOfficeCommandCandidates>

/** The back end `officeCommandCandidates` query. Rejects with the back end failure (message localized by the server). */
export const queryOfficeCommandCandidates = async ({
    query = QueryOfficeCommandCandidates.Query1,
    signal,
}: QueryOfficeCommandCandidatesParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
