import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RequestVideoRenderMutation, RequestVideoRenderMutationVariables } from "../__generated__/graphql"

/** The input of the `requestVideoRender` mutation. */
type MutateRequestVideoRenderRequest = WireInput<RequestVideoRenderMutationVariables["input"]>

/** The generated payload of the `requestVideoRender` mutation. */
type MutateRequestVideoRenderResponse = RequestVideoRenderMutation

type Document = TypedDocumentNode<MutateRequestVideoRenderResponse, InputVariables<MutateRequestVideoRenderRequest>>

const mutation1: Document = gql`
    mutation RequestVideoRender($input: RequestVideoRenderInput!) {
        requestVideoRender(input: $input) {
            id
            projectId
            renderId
            status
        }
    }
`

enum MutationRequestVideoRender {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestVideoRender, Document> = {
    [MutationRequestVideoRender.Mutation1]: mutation1,
}

/** Apollo options for the `requestVideoRender` mutation. */
type MutateRequestVideoRenderParams = MutateParams<MutationRequestVideoRender, MutateRequestVideoRenderRequest>

/** Calls `requestVideoRender` through the authenticated back end GraphQL API. */
export const mutateRequestVideoRender = async ({
    mutation = MutationRequestVideoRender.Mutation1,
    request,
    signal,
}: MutateRequestVideoRenderParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
