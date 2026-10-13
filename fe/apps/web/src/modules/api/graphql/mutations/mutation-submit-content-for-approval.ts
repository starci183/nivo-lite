import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSubmitContentForApprovalArgs } from "../__generated__/schema"

/** The input of the `submitContentForApproval` mutation. */
type MutateSubmitContentForApprovalRequest = MutationSubmitContentForApprovalArgs["input"]

/** The generated payload of the `submitContentForApproval` mutation. */
type MutateSubmitContentForApprovalResponse = Pick<Mutation, "submitContentForApproval">

type Document = TypedDocumentNode<
    MutateSubmitContentForApprovalResponse,
    InputVariables<MutateSubmitContentForApprovalRequest>
>

const mutation1: Document = gql`
    mutation SubmitContentForApproval($input: SubmitContentForApprovalInput!) {
        submitContentForApproval(input: $input) {
            id
            status
            workItemId
        }
    }
`

enum MutationSubmitContentForApproval {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSubmitContentForApproval, Document> = {
    [MutationSubmitContentForApproval.Mutation1]: mutation1,
}

/** Apollo options for the `submitContentForApproval` mutation. */
type MutateSubmitContentForApprovalParams = MutateParams<
    MutationSubmitContentForApproval,
    MutateSubmitContentForApprovalRequest
> & {
    request: MutateSubmitContentForApprovalRequest
}

/** Runs `submitContentForApproval` through the authenticated back end GraphQL API. */
export const mutateSubmitContentForApproval = async ({
    mutation = MutationSubmitContentForApproval.Mutation1,
    request,
    signal,
}: MutateSubmitContentForApprovalParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
