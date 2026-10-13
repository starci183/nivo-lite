import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSuggestLeadOwnerArgs } from "../__generated__/schema"

/** Generated input of the suggestLeadOwner mutation. */
export type MutateSuggestLeadOwnerRequest = MutationSuggestLeadOwnerArgs["input"]

/** Generated response of the suggestLeadOwner mutation. */
type MutateSuggestLeadOwnerResponse = Pick<Mutation, "suggestLeadOwner">

type Document = TypedDocumentNode<MutateSuggestLeadOwnerResponse, InputVariables<MutateSuggestLeadOwnerRequest>>

const mutation1: Document = gql`
    mutation SuggestLeadOwner($input: SuggestLeadOwnerInput!) {
        suggestLeadOwner(input: $input) {
            id
            status
        }
    }
`

enum MutationSuggestLeadOwner {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSuggestLeadOwner, Document> = {
    [MutationSuggestLeadOwner.Mutation1]: mutation1,
}

/** Apollo parameters for the suggestLeadOwner mutation. */
type MutateSuggestLeadOwnerParams = MutateParams<MutationSuggestLeadOwner, MutateSuggestLeadOwnerRequest>

/** Runs the workspace-scoped suggestLeadOwner mutation through the authenticated GraphQL client. */
export const mutateSuggestLeadOwner = async ({
    mutation = MutationSuggestLeadOwner.Mutation1,
    request,
    signal,
    headers,
}: MutateSuggestLeadOwnerParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
