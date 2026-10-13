import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateDecideWorkItemRequest, MutateDecideWorkItemResponse } from "./types/decide-work-item"

const mutation1 = gql`
    mutation DecideWorkItem($input: DecideWorkItemInput!) {
        decideWorkItem(input: $input) {
            id status
        }
    }
`

export enum MutationDecideWorkItem {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDecideWorkItem, DocumentNode> = {
    [MutationDecideWorkItem.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDecideWorkItem}. */
export type MutationDecideWorkItemParams = MutateParams<MutationDecideWorkItem, MutateDecideWorkItemRequest>

/** Approves or rejects a waiting work item (with optional edits, such as a corrected promo draft). */
export const mutateDecideWorkItem = async ({ mutation = MutationDecideWorkItem.Mutation1, request, signal }: MutationDecideWorkItemParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateDecideWorkItemResponse, InputVariables<MutateDecideWorkItemRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
