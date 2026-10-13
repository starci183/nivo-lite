import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRequestVideoRenderArgs } from "../__generated__/schema"

/** The input of the `requestVideoRender` mutation. */
type MutateRequestVideoRenderRequest = MutationRequestVideoRenderArgs["input"]

/** The generated payload of the `requestVideoRender` mutation. */
type MutateRequestVideoRenderResponse = Pick<Mutation, "requestVideoRender">

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
