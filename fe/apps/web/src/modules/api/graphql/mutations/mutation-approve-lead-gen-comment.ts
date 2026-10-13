import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationApproveLeadGenCommentArgs } from "../__generated__/schema"

/** Approving a public comment uses only generated GraphQL input and output types. */
export type MutateApproveLeadGenCommentRequest = MutationApproveLeadGenCommentArgs["input"]

/** The MutateApproveLeadGenCommentResponse of this operation, straight from the generated schema. */
type MutateApproveLeadGenCommentResponse = Pick<Mutation, "approveLeadGenComment">

type Document = TypedDocumentNode<
    MutateApproveLeadGenCommentResponse,
    InputVariables<MutateApproveLeadGenCommentRequest>
>

const mutation1: Document = gql`
    mutation ApproveLeadGenComment($input: ApproveLeadGenCommentInput!) {
        approveLeadGenComment(input: $input) {
            id
            status
            workStatus
            resultHref
            errorCode
        }
    }
`

enum MutationApproveLeadGenComment {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationApproveLeadGenComment, Document> = {
    [MutationApproveLeadGenComment.Mutation1]: mutation1,
}

/** Apollo params for the MutationApproveLeadGenComment operation. */
type MutateApproveLeadGenCommentParams = MutateParams<MutationApproveLeadGenComment, MutateApproveLeadGenCommentRequest>

/** Queues a public reply approval and immediately returns its status identity. */
export const mutateApproveLeadGenComment = async ({
    mutation = MutationApproveLeadGenComment.Mutation1,
    request,
    signal,
}: MutateApproveLeadGenCommentParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
