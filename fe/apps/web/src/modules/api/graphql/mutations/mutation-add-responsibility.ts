import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AddResponsibilityMutation, AddResponsibilityMutationVariables } from "../__generated__/graphql"

/** Generated input of the addResponsibility mutation. */
export type MutateAddResponsibilityRequest = WireInput<AddResponsibilityMutationVariables["input"]>

/** Generated response of the addResponsibility mutation. */
type MutateAddResponsibilityResponse = AddResponsibilityMutation

type Document = TypedDocumentNode<MutateAddResponsibilityResponse, InputVariables<MutateAddResponsibilityRequest>>

const mutation1: Document = gql`
    mutation AddResponsibility($input: AddResponsibilityInput!) {
        addResponsibility(input: $input) {
            dueAt
            id
            leadId
            nextAction
            ownerAgentId
            ownerKind
            ownerName
            status
            title
        }
    }
`

enum MutationAddResponsibility {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationAddResponsibility, Document> = {
    [MutationAddResponsibility.Mutation1]: mutation1,
}

/** Apollo parameters for the addResponsibility mutation. */
type MutateAddResponsibilityParams = MutateParams<MutationAddResponsibility, MutateAddResponsibilityRequest>

/** Runs the workspace-scoped addResponsibility mutation through the authenticated GraphQL client. */
export const mutateAddResponsibility = async ({
    mutation = MutationAddResponsibility.Mutation1,
    request,
    signal,
    headers,
}: MutateAddResponsibilityParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
