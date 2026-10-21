import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ApproveMcpConnectorMutation, ApproveMcpConnectorMutationVariables } from "../__generated__/graphql"

/** The input of the `approveMcpConnector` mutation. */
export type MutateApproveMcpConnectorRequest = WireInput<ApproveMcpConnectorMutationVariables["input"]>

type MutateApproveMcpConnectorResponse = ApproveMcpConnectorMutation

const mutation1: TypedDocumentNode<
    MutateApproveMcpConnectorResponse,
    InputVariables<MutateApproveMcpConnectorRequest>
> = gql`
    mutation ApproveMcpConnector($input: ApproveMcpConnectorInput!) {
        approveMcpConnector(input: $input)
    }
`

enum MutationApproveMcpConnector {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationApproveMcpConnector,
    TypedDocumentNode<MutateApproveMcpConnectorResponse, InputVariables<MutateApproveMcpConnectorRequest>>
> = {
    [MutationApproveMcpConnector.Mutation1]: mutation1,
}

/** The back end `approveMcpConnector` mutation: approves the live tool catalog of a remote connector; answers how many tools may run. */
export const mutateApproveMcpConnector = async ({
    mutation = MutationApproveMcpConnector.Mutation1,
    request,
    signal,
}: MutateParams<MutationApproveMcpConnector, MutateApproveMcpConnectorRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
