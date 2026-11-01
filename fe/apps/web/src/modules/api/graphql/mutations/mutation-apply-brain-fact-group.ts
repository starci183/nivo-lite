import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ApplyBrainFactGroupMutation, ApplyBrainFactGroupMutationVariables } from "../__generated__/graphql"

/** The response of the `applyBrainFactGroup` mutation: the typed payload straight from the back end contract. */
type MutateApplyBrainFactGroupResponse = ApplyBrainFactGroupMutation

/** The input of the `applyBrainFactGroup` mutation. */
export type MutateApplyBrainFactGroupRequest = WireInput<ApplyBrainFactGroupMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateApplyBrainFactGroupResponse,
    InputVariables<MutateApplyBrainFactGroupRequest>
> = gql`
    mutation ApplyBrainFactGroup($input: ApplyBrainFactGroupInput!) {
        applyBrainFactGroup(input: $input) {
            applied
            batchId
            skipped
        }
    }
`

enum MutationApplyBrainFactGroup {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationApplyBrainFactGroup,
    TypedDocumentNode<MutateApplyBrainFactGroupResponse, InputVariables<MutateApplyBrainFactGroupRequest>>
> = {
    [MutationApplyBrainFactGroup.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateApplyBrainFactGroup}. */
type MutateApplyBrainFactGroupParams = MutateParams<MutationApplyBrainFactGroup, MutateApplyBrainFactGroupRequest>

/**
 * Applies the checked facts of one internal document together, as one batch that can be taken back (the back end
 * `applyBrainFactGroup` mutation). Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateApplyBrainFactGroup = async ({
    mutation = MutationApplyBrainFactGroup.Mutation1,
    request,
    signal,
}: MutateApplyBrainFactGroupParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
