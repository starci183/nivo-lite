import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DecideLeadFreezeMutation, DecideLeadFreezeMutationVariables } from "../__generated__/graphql"

/** The input of the `decideLeadFreeze` mutation. */
export type MutateDecideLeadFreezeRequest = WireInput<DecideLeadFreezeMutationVariables["input"]>

type MutateDecideLeadFreezeResponse = DecideLeadFreezeMutation

const mutation1: TypedDocumentNode<MutateDecideLeadFreezeResponse, InputVariables<MutateDecideLeadFreezeRequest>> = gql`
    mutation DecideLeadFreeze($input: DecideLeadFreezeInput!) {
        decideLeadFreeze(input: $input) {
            outcome
        }
    }
`

enum MutationDecideLeadFreeze {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDecideLeadFreeze,
    TypedDocumentNode<MutateDecideLeadFreezeResponse, InputVariables<MutateDecideLeadFreezeRequest>>
> = {
    [MutationDecideLeadFreeze.Mutation1]: mutation1,
}

/** The back end `decideLeadFreeze` mutation: retry the failed run, take the conversation over, or skip the turn. */
export const mutateDecideLeadFreeze = async ({
    mutation = MutationDecideLeadFreeze.Mutation1,
    request,
    signal,
}: MutateParams<MutationDecideLeadFreeze, MutateDecideLeadFreezeRequest>): Promise<
    ApolloClient.MutateResult<MutateDecideLeadFreezeResponse>
> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
