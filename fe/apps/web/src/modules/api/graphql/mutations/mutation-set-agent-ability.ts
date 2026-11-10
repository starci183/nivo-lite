import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetAgentAbilityMutation, SetAgentAbilityMutationVariables } from "../__generated__/graphql"

/** The input of the `setAgentAbility` mutation. */
export type MutateSetAgentAbilityRequest = WireInput<SetAgentAbilityMutationVariables["input"]>

/** The response of the `setAgentAbility` mutation. */
type MutateSetAgentAbilityResponse = SetAgentAbilityMutation

type Document = TypedDocumentNode<MutateSetAgentAbilityResponse, InputVariables<MutateSetAgentAbilityRequest>>

const mutation1: Document = gql`
    mutation SetAgentAbility($input: SetAgentAbilityInput!) {
        setAgentAbility(input: $input)
    }
`

enum MutateSetAgentAbilityDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutateSetAgentAbilityDocument, Document> = {
    [MutateSetAgentAbilityDocument.Mutation1]: mutation1,
}

type MutateSetAgentAbilityParams = MutateParams<MutateSetAgentAbilityDocument, MutateSetAgentAbilityRequest>

/** Sets one ability of an attached provider to off, auto or ask (owner or manager). Rejects with the back end failure. */
export const mutateSetAgentAbility = async ({
    mutation = MutateSetAgentAbilityDocument.Mutation1,
    request,
    signal,
}: MutateSetAgentAbilityParams): Promise<ApolloClient.MutateResult<MutateSetAgentAbilityResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
