import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { CreateLeadMutation, CreateLeadMutationVariables } from "../__generated__/graphql"

/** Generated input of the createLead mutation. */
export type MutateCreateLeadRequest = WireInput<CreateLeadMutationVariables["input"]>

/** Generated response of the createLead mutation. */
type MutateCreateLeadResponse = CreateLeadMutation

type Document = TypedDocumentNode<MutateCreateLeadResponse, InputVariables<MutateCreateLeadRequest>>

const mutation1: Document = gql`
    mutation CreateLead($input: CreateLeadInput!) {
        createLead(input: $input) {
            id
            status
        }
    }
`

enum MutationCreateLead {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationCreateLead, Document> = {
    [MutationCreateLead.Mutation1]: mutation1,
}

/** Apollo parameters for the createLead mutation. */
type MutateCreateLeadParams = MutateParams<MutationCreateLead, MutateCreateLeadRequest>

/** Runs the workspace-scoped createLead mutation through the authenticated GraphQL client. */
export const mutateCreateLead = async ({
    mutation = MutationCreateLead.Mutation1,
    request,
    signal,
    headers,
}: MutateCreateLeadParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
