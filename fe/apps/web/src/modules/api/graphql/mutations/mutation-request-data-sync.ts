import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRequestDataSyncArgs } from "../__generated__/schema"

/** The input of the `requestDataSync` mutation. */
export type MutateRequestDataSyncRequest = MutationRequestDataSyncArgs["input"]

/** The response of the `requestDataSync` mutation. */
type MutateRequestDataSyncResponse = Pick<Mutation, "requestDataSync">

const mutation1: TypedDocumentNode<MutateRequestDataSyncResponse, InputVariables<MutateRequestDataSyncRequest>> = gql`
    mutation RequestDataSync($input: RequestDataSyncInput!) {
        requestDataSync(input: $input) {
            id
            connectionId
            trigger
            state
            rows
            error
            startedAt
            finishedAt
        }
    }
`

enum MutationRequestDataSync {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRequestDataSync,
    TypedDocumentNode<MutateRequestDataSyncResponse, InputVariables<MutateRequestDataSyncRequest>>
> = {
    [MutationRequestDataSync.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestDataSync}. */
type MutateRequestDataSyncParams = MutateParams<MutationRequestDataSync, MutateRequestDataSyncRequest>

/** Queues one sync of a data connection now; the run it answers is what the browser polls. */
export const mutateRequestDataSync = async ({
    mutation = MutationRequestDataSync.Mutation1,
    request,
    signal,
}: MutateRequestDataSyncParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
