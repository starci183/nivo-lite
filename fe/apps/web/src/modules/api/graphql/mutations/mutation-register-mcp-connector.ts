import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RegisterMcpConnectorMutation, RegisterMcpConnectorMutationVariables } from "../__generated__/graphql"

/** The input of the `registerMcpConnector` mutation. */
export type MutateRegisterMcpConnectorRequest = WireInput<RegisterMcpConnectorMutationVariables["input"]>

type MutateRegisterMcpConnectorResponse = RegisterMcpConnectorMutation

const mutation1: TypedDocumentNode<
    MutateRegisterMcpConnectorResponse,
    InputVariables<MutateRegisterMcpConnectorRequest>
> = gql`
    mutation RegisterMcpConnector($input: RegisterMcpConnectorInput!) {
        registerMcpConnector(input: $input)
    }
`

enum MutationRegisterMcpConnector {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRegisterMcpConnector,
    TypedDocumentNode<MutateRegisterMcpConnectorResponse, InputVariables<MutateRegisterMcpConnectorRequest>>
> = {
    [MutationRegisterMcpConnector.Mutation1]: mutation1,
}

/**
 * The back end `registerMcpConnector` mutation: registers a remote MCP server with its credential (sealed in the database, never
 * read back) and reads its tool catalog. Rejects with the back end failure.
 */
export const mutateRegisterMcpConnector = async ({
    mutation = MutationRegisterMcpConnector.Mutation1,
    request,
    signal,
}: MutateParams<MutationRegisterMcpConnector, MutateRegisterMcpConnectorRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
