import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { CreateWorkThreadMutation, CreateWorkThreadMutationVariables } from "../__generated__/graphql"

/** The input of the `createWorkThread` mutation. */
export type MutateCreateWorkThreadRequest = WireInput<CreateWorkThreadMutationVariables["input"]>

type MutateCreateWorkThreadResponse = CreateWorkThreadMutation

const mutation1: TypedDocumentNode<MutateCreateWorkThreadResponse, InputVariables<MutateCreateWorkThreadRequest>> = gql`
    mutation CreateWorkThread($input: CreateWorkThreadInput!) {
        createWorkThread(input: $input) {
            id
            title
            leadId
            orderId
            status
            createdBy
            createdAt
            updatedAt
        }
    }
`

enum MutationCreateWorkThread {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCreateWorkThread,
    TypedDocumentNode<MutateCreateWorkThreadResponse, InputVariables<MutateCreateWorkThreadRequest>>
> = {
    [MutationCreateWorkThread.Mutation1]: mutation1,
}

/** The back end `createWorkThread` mutation: opens a thread. */
export const mutateCreateWorkThread = async ({
    mutation = MutationCreateWorkThread.Mutation1,
    request,
    signal,
}: MutateParams<MutationCreateWorkThread, MutateCreateWorkThreadRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
