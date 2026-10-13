import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetHiringJobStatusMutation, SetHiringJobStatusMutationVariables } from "../__generated__/graphql"

/** The input of the `setHiringJobStatus` mutation. */
export type MutateSetHiringJobStatusRequest = WireInput<SetHiringJobStatusMutationVariables["input"]>

/** The response of the `setHiringJobStatus` mutation. */
type MutateSetHiringJobStatusResponse = SetHiringJobStatusMutation

const mutation1: TypedDocumentNode<
    MutateSetHiringJobStatusResponse,
    InputVariables<MutateSetHiringJobStatusRequest>
> = gql`
    mutation SetHiringJobStatus($input: SetHiringJobStatusInput!) {
        setHiringJobStatus(input: $input) {
            status
        }
    }
`

enum MutationSetHiringJobStatus {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetHiringJobStatus,
    TypedDocumentNode<MutateSetHiringJobStatusResponse, InputVariables<MutateSetHiringJobStatusRequest>>
> = {
    [MutationSetHiringJobStatus.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetHiringJobStatus}. */
type MutateSetHiringJobStatusParams = MutateParams<MutationSetHiringJobStatus, MutateSetHiringJobStatusRequest>

/** Runs the `setHiringJobStatus` mutation. */
export const mutateSetHiringJobStatus = async ({
    mutation = MutationSetHiringJobStatus.Mutation1,
    request,
    signal,
}: MutateSetHiringJobStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
