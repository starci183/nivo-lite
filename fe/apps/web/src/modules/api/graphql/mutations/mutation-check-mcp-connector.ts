import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { CheckMcpConnectorMutation, CheckMcpConnectorMutationVariables } from "../__generated__/graphql"

/** The input of the `checkMcpConnector` mutation. */
export type MutateCheckMcpConnectorRequest = WireInput<CheckMcpConnectorMutationVariables["input"]>

type MutateCheckMcpConnectorResponse = CheckMcpConnectorMutation

const mutation1: TypedDocumentNode<
    MutateCheckMcpConnectorResponse,
    InputVariables<MutateCheckMcpConnectorRequest>
> = gql`
    mutation CheckMcpConnector($input: CheckMcpConnectorInput!) {
        checkMcpConnector(input: $input)
    }
`

enum MutationCheckMcpConnector {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCheckMcpConnector,
    TypedDocumentNode<MutateCheckMcpConnectorResponse, InputVariables<MutateCheckMcpConnectorRequest>>
> = {
    [MutationCheckMcpConnector.Mutation1]: mutation1,
}

/** The back end `checkMcpConnector` mutation: checks that a remote connector answers MCP; answers the status it recorded. */
export const mutateCheckMcpConnector = async ({
    mutation = MutationCheckMcpConnector.Mutation1,
    request,
    signal,
}: MutateParams<MutationCheckMcpConnector, MutateCheckMcpConnectorRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
