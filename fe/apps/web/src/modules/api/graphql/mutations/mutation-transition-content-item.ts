import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationTransitionContentItemArgs } from "../__generated__/schema"

/** The input of the `transitionContentItem` mutation. */
type MutateTransitionContentItemRequest = MutationTransitionContentItemArgs["input"]

/** The generated payload of the `transitionContentItem` mutation. */
type MutateTransitionContentItemResponse = Pick<Mutation, "transitionContentItem">

type Document = TypedDocumentNode<
    MutateTransitionContentItemResponse,
    InputVariables<MutateTransitionContentItemRequest>
>

const mutation1: Document = gql`
    mutation TransitionContentItem($input: TransitionContentItemInput!) {
        transitionContentItem(input: $input) {
            id
        }
    }
`

enum MutationTransitionContentItem {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationTransitionContentItem, Document> = {
    [MutationTransitionContentItem.Mutation1]: mutation1,
}

/** Apollo options for the `transitionContentItem` mutation. */
type MutateTransitionContentItemParams = MutateParams<
    MutationTransitionContentItem,
    MutateTransitionContentItemRequest
> & {
    request: MutateTransitionContentItemRequest
}

/** Runs `transitionContentItem` through the authenticated back end GraphQL API. */
export const mutateTransitionContentItem = async ({
    mutation = MutationTransitionContentItem.Mutation1,
    request,
    signal,
}: MutateTransitionContentItemParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
