import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationWantConnectorArgs } from "../__generated__/schema"

/** The input of the `wantConnector` mutation. */
export type MutateWantConnectorRequest = MutationWantConnectorArgs["input"]

/** The response of the `wantConnector` mutation. */
type MutateWantConnectorResponse = Pick<Mutation, "wantConnector">

const mutation1: TypedDocumentNode<MutateWantConnectorResponse, InputVariables<MutateWantConnectorRequest>> = gql`
    mutation WantConnector($input: WantConnectorInput!) {
        wantConnector(input: $input)
    }
`

enum MutationWantConnector {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationWantConnector,
    TypedDocumentNode<MutateWantConnectorResponse, InputVariables<MutateWantConnectorRequest>>
> = {
    [MutationWantConnector.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateWantConnector}. */
type MutateWantConnectorParams = MutateParams<MutationWantConnector, MutateWantConnectorRequest>

/** Records that the workspace wants a planned connector. */
export const mutateWantConnector = async ({
    mutation = MutationWantConnector.Mutation1,
    request,
    signal,
}: MutateWantConnectorParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
