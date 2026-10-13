import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationDecideWorkItemArgs } from "../__generated__/schema"

/** The input of the `decideWorkItem` mutation. */
export type MutateDecideWorkItemRequest = MutationDecideWorkItemArgs["input"]

type MutateDecideWorkItemResponse = { decideWorkItem: Pick<Mutation["decideWorkItem"], "id" | "status"> }

const mutation1: TypedDocumentNode<MutateDecideWorkItemResponse, InputVariables<MutateDecideWorkItemRequest>> = gql`
    mutation DecideWorkItem($input: DecideWorkItemInput!) {
        decideWorkItem(input: $input) {
            id
            status
        }
    }
`

enum MutationDecideWorkItem {
    Mutation1 = "mutation1",
}
const mutationMap: Record<MutationDecideWorkItem, typeof mutation1> = { [MutationDecideWorkItem.Mutation1]: mutation1 }

/** Approves an optionally edited proposal or rejects a waiting work item. */
export const mutateDecideWorkItem = async ({
    mutation = MutationDecideWorkItem.Mutation1,
    request,
    signal,
}: MutateParams<MutationDecideWorkItem, MutateDecideWorkItemRequest>) =>
    createAuthApolloClient({ signal }).mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
