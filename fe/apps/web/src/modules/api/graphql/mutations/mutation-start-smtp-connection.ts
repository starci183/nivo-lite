import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { StartSmtpConnectionMutation, StartSmtpConnectionMutationVariables } from "../__generated__/graphql"

/** The input of the `startSmtpConnection` mutation. */
export type MutateStartSmtpConnectionRequest = WireInput<StartSmtpConnectionMutationVariables["input"]>

/** The response of the `startSmtpConnection` mutation. */
type MutateStartSmtpConnectionResponse = StartSmtpConnectionMutation

const mutation1: TypedDocumentNode<
    MutateStartSmtpConnectionResponse,
    InputVariables<MutateStartSmtpConnectionRequest>
> = gql`
    mutation StartSmtpConnection($input: StartSmtpConnectionInput!) {
        startSmtpConnection(input: $input) {
            id
            host
            fromEmail
            isDefault
        }
    }
`

enum MutationStartSmtpConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationStartSmtpConnection,
    TypedDocumentNode<MutateStartSmtpConnectionResponse, InputVariables<MutateStartSmtpConnectionRequest>>
> = {
    [MutationStartSmtpConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateStartSmtpConnection}. */
type MutateStartSmtpConnectionParams = MutateParams<MutationStartSmtpConnection, MutateStartSmtpConnectionRequest>

/** Stores an outgoing email (SMTP) connection as pending. */
export const mutateStartSmtpConnection = async ({
    mutation = MutationStartSmtpConnection.Mutation1,
    request,
    signal,
}: MutateStartSmtpConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
