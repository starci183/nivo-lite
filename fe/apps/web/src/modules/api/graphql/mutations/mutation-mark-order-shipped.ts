import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { MarkOrderShippedMutation, MarkOrderShippedMutationVariables } from "../__generated__/graphql"

/** Generated input of the markOrderShipped mutation. */
export type MutateMarkOrderShippedRequest = WireInput<MarkOrderShippedMutationVariables["input"]>

/** Generated response of the markOrderShipped mutation. */
type MutateMarkOrderShippedResponse = MarkOrderShippedMutation

type Document = TypedDocumentNode<MutateMarkOrderShippedResponse, InputVariables<MutateMarkOrderShippedRequest>>

const mutation1: Document = gql`
    mutation MarkOrderShipped($input: MarkOrderShippedInput!) {
        markOrderShipped(input: $input) {
            id
            notificationId
            orderNo
        }
    }
`

enum MutationMarkOrderShipped {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationMarkOrderShipped, Document> = {
    [MutationMarkOrderShipped.Mutation1]: mutation1,
}

/** Apollo parameters for the markOrderShipped mutation. */
type MutateMarkOrderShippedParams = MutateParams<MutationMarkOrderShipped, MutateMarkOrderShippedRequest>

/** Runs the workspace-scoped markOrderShipped mutation through the authenticated GraphQL client. */
export const mutateMarkOrderShipped = async ({
    mutation = MutationMarkOrderShipped.Mutation1,
    request,
    signal,
    headers,
}: MutateMarkOrderShippedParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
