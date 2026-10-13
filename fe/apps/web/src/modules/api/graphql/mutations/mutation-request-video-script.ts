import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RequestVideoScriptMutation, RequestVideoScriptMutationVariables } from "../__generated__/graphql"

/** The input of the `requestVideoScript` mutation. */
type MutateRequestVideoScriptRequest = WireInput<RequestVideoScriptMutationVariables["input"]>

/** The generated payload of the `requestVideoScript` mutation. */
type MutateRequestVideoScriptResponse = RequestVideoScriptMutation

type Document = TypedDocumentNode<MutateRequestVideoScriptResponse, InputVariables<MutateRequestVideoScriptRequest>>

const mutation1: Document = gql`
    mutation RequestVideoScript($input: RequestVideoScriptInput!) {
        requestVideoScript(input: $input) {
            id
            projectId
            status
        }
    }
`

enum MutationRequestVideoScript {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestVideoScript, Document> = {
    [MutationRequestVideoScript.Mutation1]: mutation1,
}

/** Apollo options for the `requestVideoScript` mutation. */
type MutateRequestVideoScriptParams = MutateParams<MutationRequestVideoScript, MutateRequestVideoScriptRequest>

/** Calls `requestVideoScript` through the authenticated back end GraphQL API. */
export const mutateRequestVideoScript = async ({
    mutation = MutationRequestVideoScript.Mutation1,
    request,
    signal,
}: MutateRequestVideoScriptParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
