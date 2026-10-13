import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRequestShiftsPublishArgs } from "../__generated__/schema"

/** The input of the `requestShiftsPublish` mutation. */
export type MutateRequestShiftsPublishRequest = MutationRequestShiftsPublishArgs["input"]

/** The response of the `requestShiftsPublish` mutation. */
type MutateRequestShiftsPublishResponse = Pick<Mutation, "requestShiftsPublish">

const mutation1: TypedDocumentNode<
    MutateRequestShiftsPublishResponse,
    InputVariables<MutateRequestShiftsPublishRequest>
> = gql`
    mutation RequestShiftsPublish($input: ShiftsScheduleRefInput!) {
        requestShiftsPublish(input: $input) {
            status
        }
    }
`

enum MutationRequestShiftsPublish {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRequestShiftsPublish,
    TypedDocumentNode<MutateRequestShiftsPublishResponse, InputVariables<MutateRequestShiftsPublishRequest>>
> = {
    [MutationRequestShiftsPublish.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestShiftsPublish}. */
type MutateRequestShiftsPublishParams = MutateParams<MutationRequestShiftsPublish, MutateRequestShiftsPublishRequest>

/** Runs the `requestShiftsPublish` mutation. */
export const mutateRequestShiftsPublish = async ({
    mutation = MutationRequestShiftsPublish.Mutation1,
    request,
    signal,
}: MutateRequestShiftsPublishParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
