import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationTestWebhookConnectionArgs } from "../__generated__/schema"

/** The input of the `testWebhookConnection` mutation. */
export type MutateTestWebhookConnectionRequest = MutationTestWebhookConnectionArgs["input"]

/** The response of the `testWebhookConnection` mutation. */
type MutateTestWebhookConnectionResponse = Pick<Mutation, "testWebhookConnection">

const mutation1: TypedDocumentNode<
    MutateTestWebhookConnectionResponse,
    InputVariables<MutateTestWebhookConnectionRequest>
> = gql`
    mutation TestWebhookConnection($input: TestWebhookConnectionInput!) {
        testWebhookConnection(input: $input) {
            ok
            status
            error
            durationMs
        }
    }
`

enum MutationTestWebhookConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationTestWebhookConnection,
    TypedDocumentNode<MutateTestWebhookConnectionResponse, InputVariables<MutateTestWebhookConnectionRequest>>
> = {
    [MutationTestWebhookConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateTestWebhookConnection}. */
type MutateTestWebhookConnectionParams = MutateParams<MutationTestWebhookConnection, MutateTestWebhookConnectionRequest>

/** Sends a signed test event to the webhook. */
export const mutateTestWebhookConnection = async ({
    mutation = MutationTestWebhookConnection.Mutation1,
    request,
    signal,
}: MutateTestWebhookConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
