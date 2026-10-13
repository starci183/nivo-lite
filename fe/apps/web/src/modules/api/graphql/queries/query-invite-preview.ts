import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryInvitePreviewArgs } from "../__generated__/schema"

/** The input of the `invitePreview` query. */
export type QueryInvitePreviewRequest = QueryInvitePreviewArgs["input"]

/** The response of the `invitePreview` query: the typed payload straight from the back end contract. */
type QueryInvitePreviewResponse = Pick<Query, "invitePreview">

type Document = TypedDocumentNode<QueryInvitePreviewResponse, InputVariables<QueryInvitePreviewRequest>>

const query1: Document = gql`
    query InvitePreview($input: InviteTokenInput!) {
        invitePreview(input: $input) {
            email
            role
            staffName
            state
            workspaceName
        }
    }
`

enum QueryInvitePreview {
    Query1 = "query1",
}

const queryMap: Record<QueryInvitePreview, Document> = {
    [QueryInvitePreview.Query1]: query1,
}

/** Apollo params for {@link queryInvitePreview}. */
type QueryInvitePreviewParams = QueryParams<QueryInvitePreview, QueryInvitePreviewRequest> & {
    request: QueryInvitePreviewRequest
}

/** What an invitation link is for (public: callable without a session) (the back end `invitePreview` query). Rejects with the back end failure instead of answering partial data. */
export const queryInvitePreview = async ({
    query = QueryInvitePreview.Query1,
    request,
    signal,
}: QueryInvitePreviewParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
