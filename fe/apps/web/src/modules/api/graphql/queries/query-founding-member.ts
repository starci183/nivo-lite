import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { FoundingMemberQuery } from "../__generated__/graphql"

/** The generated workspace founding-member query response. */
type QueryFoundingMemberResponse = FoundingMemberQuery

type Document = TypedDocumentNode<QueryFoundingMemberResponse>

const query1: Document = gql`
    query FoundingMember {
        foundingMember
    }
`

enum QueryFoundingMember {
    Query1 = "query1",
}

const queryMap: Record<QueryFoundingMember, Document> = { [QueryFoundingMember.Query1]: query1 }

/** Reads the founding-member flag for the selected workspace. */
export const queryFoundingMember = async ({
    query = QueryFoundingMember.Query1,
    signal,
}: QueryParams<QueryFoundingMember> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
