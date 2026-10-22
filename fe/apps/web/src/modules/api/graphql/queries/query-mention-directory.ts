import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { MentionDirectoryQuery } from "../__generated__/graphql"

type QueryMentionDirectoryResponse = MentionDirectoryQuery

const query1: TypedDocumentNode<QueryMentionDirectoryResponse, Record<string, never>> = gql`
    query MentionDirectory {
        mentionDirectory {
            members {
                kind
                id
                name
                role
            }
            agents {
                kind
                id
                name
                role
            }
            groups {
                kind
                id
                name
                role
            }
        }
    }
`

enum QueryMentionDirectory {
    Query1 = "query1",
}

const queryMap: Record<
    QueryMentionDirectory,
    TypedDocumentNode<QueryMentionDirectoryResponse, Record<string, never>>
> = {
    [QueryMentionDirectory.Query1]: query1,
}

type QueryMentionDirectoryParams = QueryParams<QueryMentionDirectory>

/** The back end `mentionDirectory` query: the people, agents and groups the composer can tag. Rejects with the back end failure (message localized by the server). */
export const queryMentionDirectory = async ({
    query = QueryMentionDirectory.Query1,
    signal,
}: QueryMentionDirectoryParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
