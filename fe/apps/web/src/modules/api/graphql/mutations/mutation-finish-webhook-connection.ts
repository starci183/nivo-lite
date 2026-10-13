import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationFinishWebhookConnectionArgs } from "../__generated__/schema"

/** The input of the `finishWebhookConnection` mutation. */
export type MutateFinishWebhookConnectionRequest = MutationFinishWebhookConnectionArgs["input"]

/** The response of the `finishWebhookConnection` mutation. */
type MutateFinishWebhookConnectionResponse = Pick<Mutation, "finishWebhookConnection">

const mutation1: TypedDocumentNode<
    MutateFinishWebhookConnectionResponse,
    InputVariables<MutateFinishWebhookConnectionRequest>
> = gql`
    mutation FinishWebhookConnection($input: FinishWebhookConnectionInput!) {
        finishWebhookConnection(input: $input)
    }
`

enum MutationFinishWebhookConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationFinishWebhookConnection,
    TypedDocumentNode<MutateFinishWebhookConnectionResponse, InputVariables<MutateFinishWebhookConnectionRequest>>
> = {
    [MutationFinishWebhookConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateFinishWebhookConnection}. */
type MutateFinishWebhookConnectionParams = MutateParams<
    MutationFinishWebhookConnection,
    MutateFinishWebhookConnectionRequest
>

/** Marks an outgoing webhook connected. */
export const mutateFinishWebhookConnection = async ({
    mutation = MutationFinishWebhookConnection.Mutation1,
    request,
    signal,
}: MutateFinishWebhookConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
