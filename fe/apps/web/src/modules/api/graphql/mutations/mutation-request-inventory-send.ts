import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RequestInventorySendMutation, RequestInventorySendMutationVariables } from "../__generated__/graphql"

/** The input of the `requestInventorySend` mutation. */
export type MutateRequestInventorySendRequest = WireInput<RequestInventorySendMutationVariables["input"]>

/** The response of the `requestInventorySend` mutation. */
type MutateRequestInventorySendResponse = RequestInventorySendMutation

const mutation1: TypedDocumentNode<
    MutateRequestInventorySendResponse,
    InputVariables<MutateRequestInventorySendRequest>
> = gql`
    mutation RequestInventorySend($input: RequestInventorySendInput!) {
        requestInventorySend(input: $input) {
            status
        }
    }
`

enum MutationRequestInventorySend {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRequestInventorySend,
    TypedDocumentNode<MutateRequestInventorySendResponse, InputVariables<MutateRequestInventorySendRequest>>
> = {
    [MutationRequestInventorySend.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestInventorySend}. */
type MutateRequestInventorySendParams = MutateParams<MutationRequestInventorySend, MutateRequestInventorySendRequest>

/** Runs the `requestInventorySend` mutation. */
export const mutateRequestInventorySend = async ({
    mutation = MutationRequestInventorySend.Mutation1,
    request,
    signal,
}: MutateRequestInventorySendParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
