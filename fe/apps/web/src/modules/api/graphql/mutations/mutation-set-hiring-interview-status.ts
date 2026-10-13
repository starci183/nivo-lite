import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSetHiringInterviewStatusArgs } from "../__generated__/schema"

/** The input of the `setHiringInterviewStatus` mutation. */
export type MutateSetHiringInterviewStatusRequest = MutationSetHiringInterviewStatusArgs["input"]

/** The response of the `setHiringInterviewStatus` mutation. */
type MutateSetHiringInterviewStatusResponse = Pick<Mutation, "setHiringInterviewStatus">

const mutation1: TypedDocumentNode<
    MutateSetHiringInterviewStatusResponse,
    InputVariables<MutateSetHiringInterviewStatusRequest>
> = gql`
    mutation SetHiringInterviewStatus($input: SetHiringInterviewStatusInput!) {
        setHiringInterviewStatus(input: $input)
    }
`

enum MutationSetHiringInterviewStatus {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetHiringInterviewStatus,
    TypedDocumentNode<MutateSetHiringInterviewStatusResponse, InputVariables<MutateSetHiringInterviewStatusRequest>>
> = {
    [MutationSetHiringInterviewStatus.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetHiringInterviewStatus}. */
type MutateSetHiringInterviewStatusParams = MutateParams<
    MutationSetHiringInterviewStatus,
    MutateSetHiringInterviewStatusRequest
>

/** Runs the `setHiringInterviewStatus` mutation. */
export const mutateSetHiringInterviewStatus = async ({
    mutation = MutationSetHiringInterviewStatus.Mutation1,
    request,
    signal,
}: MutateSetHiringInterviewStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
