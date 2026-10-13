import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DecideSalesDraftMutation, DecideSalesDraftMutationVariables } from "../__generated__/graphql"

/** Generated input of the decideSalesDraft mutation. */
export type MutateDecideSalesDraftRequest = WireInput<DecideSalesDraftMutationVariables["input"]>

/** Generated response of the decideSalesDraft mutation. */
type MutateDecideSalesDraftResponse = DecideSalesDraftMutation

type Document = TypedDocumentNode<MutateDecideSalesDraftResponse, InputVariables<MutateDecideSalesDraftRequest>>

const mutation1: Document = gql`
    mutation DecideSalesDraft($input: DecideSalesDraftInput!) {
        decideSalesDraft(input: $input) {
            errorCode
            id
            status
            workItemId
        }
    }
`

enum MutationDecideSalesDraft {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDecideSalesDraft, Document> = {
    [MutationDecideSalesDraft.Mutation1]: mutation1,
}

/** Apollo parameters for the decideSalesDraft mutation. */
type MutateDecideSalesDraftParams = MutateParams<MutationDecideSalesDraft, MutateDecideSalesDraftRequest>

/** Runs the workspace-scoped decideSalesDraft mutation through the authenticated GraphQL client. */
export const mutateDecideSalesDraft = async ({
    mutation = MutationDecideSalesDraft.Mutation1,
    request,
    signal,
    headers,
}: MutateDecideSalesDraftParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
