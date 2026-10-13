import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRequestAgentSyncArgs } from "../__generated__/schema"

/** The input of the `requestAgentSync` mutation. */
export type MutateRequestAgentSyncRequest = MutationRequestAgentSyncArgs["input"]

type MutateRequestAgentSyncResponse = Pick<Mutation, "requestAgentSync">

const mutation1: TypedDocumentNode<MutateRequestAgentSyncResponse, InputVariables<MutateRequestAgentSyncRequest>> = gql`
    mutation RequestAgentSync($input: RequestAgentSyncInput!) {
        requestAgentSync(input: $input) {
            ok
        }
    }
`

enum MutationRequestAgentSync {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRequestAgentSync,
    TypedDocumentNode<MutateRequestAgentSyncResponse, InputVariables<MutateRequestAgentSyncRequest>>
> = {
    [MutationRequestAgentSync.Mutation1]: mutation1,
}

/** The back end `requestAgentSync` mutation. */
export const mutateRequestAgentSync = async ({
    mutation = MutationRequestAgentSync.Mutation1,
    request,
    signal,
}: MutateParams<MutationRequestAgentSync, MutateRequestAgentSyncRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
