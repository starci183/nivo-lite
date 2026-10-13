import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationDecideSalesWorkItemArgs } from "../__generated__/schema"

/** Generated input of the decideSalesWorkItem mutation. */
export type MutateDecideSalesWorkItemRequest = MutationDecideSalesWorkItemArgs["input"]

/** Generated response of the decideSalesWorkItem mutation. */
type MutateDecideSalesWorkItemResponse = Pick<Mutation, "decideSalesWorkItem">

type Document = TypedDocumentNode<MutateDecideSalesWorkItemResponse, InputVariables<MutateDecideSalesWorkItemRequest>>

const mutation1: Document = gql`
    mutation DecideSalesWorkItem($input: DecideSalesWorkItemInput!) {
        decideSalesWorkItem(input: $input) {
            errorCode
            id
            status
            workItemId
        }
    }
`

enum MutationDecideSalesWorkItem {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDecideSalesWorkItem, Document> = {
    [MutationDecideSalesWorkItem.Mutation1]: mutation1,
}

/** Apollo parameters for the decideSalesWorkItem mutation. */
type MutateDecideSalesWorkItemParams = MutateParams<MutationDecideSalesWorkItem, MutateDecideSalesWorkItemRequest>

/** Runs the workspace-scoped decideSalesWorkItem mutation through the authenticated GraphQL client. */
export const mutateDecideSalesWorkItem = async ({
    mutation = MutationDecideSalesWorkItem.Mutation1,
    request,
    signal,
    headers,
}: MutateDecideSalesWorkItemParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
