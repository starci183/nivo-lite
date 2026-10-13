import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationStartWebhookConnectionArgs } from "../__generated__/schema"

/** The input of the `startWebhookConnection` mutation. */
export type MutateStartWebhookConnectionRequest = MutationStartWebhookConnectionArgs["input"]

/** The response of the `startWebhookConnection` mutation. */
type MutateStartWebhookConnectionResponse = Pick<Mutation, "startWebhookConnection">

const mutation1: TypedDocumentNode<
    MutateStartWebhookConnectionResponse,
    InputVariables<MutateStartWebhookConnectionRequest>
> = gql`
    mutation StartWebhookConnection($input: StartWebhookConnectionInput!) {
        startWebhookConnection(input: $input) {
            id
            name
            host
            events
            signingSecret
        }
    }
`

enum MutationStartWebhookConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationStartWebhookConnection,
    TypedDocumentNode<MutateStartWebhookConnectionResponse, InputVariables<MutateStartWebhookConnectionRequest>>
> = {
    [MutationStartWebhookConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateStartWebhookConnection}. */
type MutateStartWebhookConnectionParams = MutateParams<
    MutationStartWebhookConnection,
    MutateStartWebhookConnectionRequest
>

/** Creates an outgoing webhook connection. */
export const mutateStartWebhookConnection = async ({
    mutation = MutationStartWebhookConnection.Mutation1,
    request,
    signal,
}: MutateStartWebhookConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
