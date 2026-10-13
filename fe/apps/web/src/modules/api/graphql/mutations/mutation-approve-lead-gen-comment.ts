import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationApproveLeadGenCommentArgs } from "../__generated__/schema"

/** Generated input of the approveLeadGenComment mutation. */
export type MutateApproveLeadGenCommentRequest = MutationApproveLeadGenCommentArgs["input"]

/** Generated response of the approveLeadGenComment mutation. */
type MutateApproveLeadGenCommentResponse = Pick<Mutation, "approveLeadGenComment">

type Document = TypedDocumentNode<
    MutateApproveLeadGenCommentResponse,
    InputVariables<MutateApproveLeadGenCommentRequest>
>

const mutation1: Document = gql`
    mutation ApproveLeadGenComment($input: ApproveLeadGenCommentInput!) {
        approveLeadGenComment(input: $input) {
            errorCode
            id
            resultHref
            status
            workStatus
        }
    }
`

enum MutationApproveLeadGenComment {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationApproveLeadGenComment, Document> = {
    [MutationApproveLeadGenComment.Mutation1]: mutation1,
}

/** Apollo parameters for the approveLeadGenComment mutation. */
type MutateApproveLeadGenCommentParams = MutateParams<MutationApproveLeadGenComment, MutateApproveLeadGenCommentRequest>

/** Runs the workspace-scoped approveLeadGenComment mutation through the authenticated GraphQL client. */
export const mutateApproveLeadGenComment = async ({
    mutation = MutationApproveLeadGenComment.Mutation1,
    request,
    signal,
    headers,
}: MutateApproveLeadGenCommentParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
