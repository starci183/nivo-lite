import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { TestWebhookConnectionMutation, TestWebhookConnectionMutationVariables } from "../__generated__/graphql"

/** The input of the `testWebhookConnection` mutation. */
type MutateTestWebhookConnectionRequest = WireInput<TestWebhookConnectionMutationVariables["input"]>

/** The response of the `testWebhookConnection` mutation. */
type MutateTestWebhookConnectionResponse = TestWebhookConnectionMutation

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
}: MutateTestWebhookConnectionParams): Promise<ApolloClient.MutateResult<MutateTestWebhookConnectionResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
