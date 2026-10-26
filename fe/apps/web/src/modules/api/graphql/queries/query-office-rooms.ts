import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { OfficeRoomsQuery } from "../__generated__/graphql"

type QueryOfficeRoomsResponse = OfficeRoomsQuery

const query1: TypedDocumentNode<QueryOfficeRoomsResponse, Record<string, never>> = gql`
    query OfficeRooms {
        officeRooms {
            key
            name
            position
            unread
            last_body
            last_author
            last_author_user_id
            last_at
            agent_ids
            home_agent_ids
            user_ids
            members {
                count
                preview {
                    id
                    kind
                    module
                    name
                    avatarUrl
                }
            }
            pins {
                id
                title
                href
                note
            }
        }
    }
`

enum QueryOfficeRooms {
    Query1 = "query1",
}

const queryMap: Record<QueryOfficeRooms, TypedDocumentNode<QueryOfficeRoomsResponse, Record<string, never>>> = {
    [QueryOfficeRooms.Query1]: query1,
}

/** The back end `officeRooms` query: the Office room and the department rooms with the caller's unread counts. */
export const queryOfficeRooms = async ({
    query = QueryOfficeRooms.Query1,
    signal,
}: QueryParams<QueryOfficeRooms> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
