import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AssignResponsibilityMutation, AssignResponsibilityMutationVariables } from "../__generated__/graphql"

/** Generated input of the assignResponsibility mutation. */
export type MutateAssignResponsibilityRequest = WireInput<AssignResponsibilityMutationVariables["input"]>

/** Generated response of the assignResponsibility mutation. */
type MutateAssignResponsibilityResponse = AssignResponsibilityMutation

type Document = TypedDocumentNode<MutateAssignResponsibilityResponse, InputVariables<MutateAssignResponsibilityRequest>>

const mutation1: Document = gql`
    mutation AssignResponsibility($input: AssignResponsibilityInput!) {
        assignResponsibility(input: $input) {
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

enum MutationAssignResponsibility {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationAssignResponsibility, Document> = {
    [MutationAssignResponsibility.Mutation1]: mutation1,
}

/** Apollo parameters for the assignResponsibility mutation. */
type MutateAssignResponsibilityParams = MutateParams<MutationAssignResponsibility, MutateAssignResponsibilityRequest>

/** Runs the workspace-scoped assignResponsibility mutation through the authenticated GraphQL client. */
export const mutateAssignResponsibility = async ({
    mutation = MutationAssignResponsibility.Mutation1,
    request,
    signal,
    headers,
}: MutateAssignResponsibilityParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
