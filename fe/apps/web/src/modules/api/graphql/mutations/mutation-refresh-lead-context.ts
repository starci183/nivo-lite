import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RefreshLeadContextMutation, RefreshLeadContextMutationVariables } from "../__generated__/graphql"

/** Generated input of the refreshLeadContext mutation. */
export type MutateRefreshLeadContextRequest = WireInput<RefreshLeadContextMutationVariables["input"]>

/** Generated response of the refreshLeadContext mutation. */
type MutateRefreshLeadContextResponse = RefreshLeadContextMutation

type Document = TypedDocumentNode<MutateRefreshLeadContextResponse, InputVariables<MutateRefreshLeadContextRequest>>

const mutation1: Document = gql`
    mutation RefreshLeadContext($input: RefreshLeadContextInput!) {
        refreshLeadContext(input: $input) {
            id
            status
        }
    }
`

enum MutationRefreshLeadContext {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRefreshLeadContext, Document> = {
    [MutationRefreshLeadContext.Mutation1]: mutation1,
}

/** Apollo parameters for the refreshLeadContext mutation. */
type MutateRefreshLeadContextParams = MutateParams<MutationRefreshLeadContext, MutateRefreshLeadContextRequest>

/** Runs the workspace-scoped refreshLeadContext mutation through the authenticated GraphQL client. */
export const mutateRefreshLeadContext = async ({
    mutation = MutationRefreshLeadContext.Mutation1,
    request,
    signal,
    headers,
}: MutateRefreshLeadContextParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
