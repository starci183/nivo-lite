import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RecheckZaloConnectionMutation, RecheckZaloConnectionMutationVariables } from "../__generated__/graphql"

/** The input of the `recheckZaloConnection` mutation. */
type MutateRecheckZaloConnectionRequest = WireInput<RecheckZaloConnectionMutationVariables["input"]>

/** The response of the `recheckZaloConnection` mutation. */
type MutateRecheckZaloConnectionResponse = RecheckZaloConnectionMutation

const mutation1: TypedDocumentNode<
    MutateRecheckZaloConnectionResponse,
    InputVariables<MutateRecheckZaloConnectionRequest>
> = gql`
    mutation RecheckZaloConnection($input: RecheckZaloConnectionInput!) {
        recheckZaloConnection(input: $input) {
            id
            name
            status
            healthy
            oaId
            appId
            appSecretMask
            oaSecretMask
            callbackUrl
            webhookUrl
            access {
                state
                expiresAt
                expiredMinutesAgo
                canRefresh
            }
            checks {
                key
                state
                code
                at
                names
            }
            recipients {
                userId
                name
                lastMessageAt
            }
            sendBlock
            agentIds
        }
    }
`

enum MutationRecheckZaloConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRecheckZaloConnection,
    TypedDocumentNode<MutateRecheckZaloConnectionResponse, InputVariables<MutateRecheckZaloConnectionRequest>>
> = {
    [MutationRecheckZaloConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRecheckZaloConnection}. */
type MutateRecheckZaloConnectionParams = MutateParams<MutationRecheckZaloConnection, MutateRecheckZaloConnectionRequest>

/** Runs the check of a Zalo OA connection again. Rejects with the back end failure. */
export const mutateRecheckZaloConnection = async ({
    mutation = MutationRecheckZaloConnection.Mutation1,
    request,
    signal,
}: MutateRecheckZaloConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
