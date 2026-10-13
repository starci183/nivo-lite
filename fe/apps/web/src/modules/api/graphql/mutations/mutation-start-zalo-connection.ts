import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationStartZaloConnectionArgs } from "../__generated__/schema"

/** The input of the `startZaloConnection` mutation. */
export type MutateStartZaloConnectionRequest = MutationStartZaloConnectionArgs["input"]

/** The response of the `startZaloConnection` mutation. */
type MutateStartZaloConnectionResponse = Pick<Mutation, "startZaloConnection">

const mutation1: TypedDocumentNode<
    MutateStartZaloConnectionResponse,
    InputVariables<MutateStartZaloConnectionRequest>
> = gql`
    mutation StartZaloConnection($input: StartZaloConnectionInput!) {
        startZaloConnection(input: $input) {
            id
            name
            status
            webhookUrl
            callbackUrl
            authorized
            oaSecretSaved
            oaId
            firstEvent {
                amount
                at
                content
            }
            agentIds
        }
    }
`

enum MutationStartZaloConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationStartZaloConnection,
    TypedDocumentNode<MutateStartZaloConnectionResponse, InputVariables<MutateStartZaloConnectionRequest>>
> = {
    [MutationStartZaloConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateStartZaloConnection}. */
type MutateStartZaloConnectionParams = MutateParams<MutationStartZaloConnection, MutateStartZaloConnectionRequest>

/** Creates a Zalo OA connection from the app keys. */
export const mutateStartZaloConnection = async ({
    mutation = MutationStartZaloConnection.Mutation1,
    request,
    signal,
}: MutateStartZaloConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
