import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { MarkContentPublishedMutation, MarkContentPublishedMutationVariables } from "../__generated__/graphql"

/** The input of the `markContentPublished` mutation. */
type MutateMarkContentPublishedRequest = WireInput<MarkContentPublishedMutationVariables["input"]>

/** The generated payload of the `markContentPublished` mutation. */
type MutateMarkContentPublishedResponse = MarkContentPublishedMutation

type Document = TypedDocumentNode<MutateMarkContentPublishedResponse, InputVariables<MutateMarkContentPublishedRequest>>

const mutation1: Document = gql`
    mutation MarkContentPublished($input: MarkContentPublishedInput!) {
        markContentPublished(input: $input) {
            allDone
            id
        }
    }
`

enum MutationMarkContentPublished {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationMarkContentPublished, Document> = {
    [MutationMarkContentPublished.Mutation1]: mutation1,
}

/** Apollo options for the `markContentPublished` mutation. */
type MutateMarkContentPublishedParams = MutateParams<
    MutationMarkContentPublished,
    MutateMarkContentPublishedRequest
> & {
    request: MutateMarkContentPublishedRequest
}

/** Runs `markContentPublished` through the authenticated back end GraphQL API. */
export const mutateMarkContentPublished = async ({
    mutation = MutationMarkContentPublished.Mutation1,
    request,
    signal,
}: MutateMarkContentPublishedParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
