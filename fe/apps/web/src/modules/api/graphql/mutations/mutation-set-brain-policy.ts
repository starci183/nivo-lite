import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SetBrainPolicyMutation, SetBrainPolicyMutationVariables } from "../__generated__/graphql"

/** The response of the `setBrainPolicy` mutation: the typed payload straight from the back end contract. */
type MutateSetBrainPolicyResponse = SetBrainPolicyMutation

/** The input of the `setBrainPolicy` mutation. */
export type MutateSetBrainPolicyRequest = WireInput<SetBrainPolicyMutationVariables["input"]>

const mutation1: TypedDocumentNode<MutateSetBrainPolicyResponse, InputVariables<MutateSetBrainPolicyRequest>> = gql`
    mutation SetBrainPolicy($input: SetBrainPolicyInput!) {
        setBrainPolicy(input: $input) {
            outcome
            problem
            factId
            value
        }
    }
`

enum MutationSetBrainPolicy {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetBrainPolicy,
    TypedDocumentNode<MutateSetBrainPolicyResponse, InputVariables<MutateSetBrainPolicyRequest>>
> = {
    [MutationSetBrainPolicy.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetBrainPolicy}. */
type MutateSetBrainPolicyParams = MutateParams<MutationSetBrainPolicy, MutateSetBrainPolicyRequest>

/**
 * Writes a new value of one shop rule, now or from a date, and who may read it: the owner's edit is a new version of the fact, a
 * manager's a proposal. A refused value answers `invalid` with its problem; a refused caller rejects with the back end failure
 * (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateSetBrainPolicy = async ({
    mutation = MutationSetBrainPolicy.Mutation1,
    request,
    signal,
}: MutateSetBrainPolicyParams): Promise<ApolloClient.MutateResult<MutateSetBrainPolicyResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
