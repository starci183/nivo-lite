import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AssignInboxLeadMutation, AssignInboxLeadMutationVariables } from "../__generated__/graphql"

/** Generated input of the AssignInboxLead mutation. */
type MutateAssignInboxLeadRequest = WireInput<AssignInboxLeadMutationVariables["input"]>

type MutateAssignInboxLeadResponse = AssignInboxLeadMutation

type Document = TypedDocumentNode<MutateAssignInboxLeadResponse, InputVariables<MutateAssignInboxLeadRequest>>

const mutation1: Document = gql`
    mutation AssignInboxLead($input: AssignInboxLeadInput!) {
        assignInboxLead(input: $input)
    }
`

enum MutationAssignInboxLead {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationAssignInboxLead, Document> = { [MutationAssignInboxLead.Mutation1]: mutation1 }

/** Parameters of the AssignInboxLead mutation. */
type MutateAssignInboxLeadParams = MutateParams<MutationAssignInboxLead, MutateAssignInboxLeadRequest>

/** Hands one customer to an agent, or takes it back; owner or manager. */
export const mutateAssignInboxLead = async ({
    mutation = MutationAssignInboxLead.Mutation1,
    request,
    signal,
    headers,
}: MutateAssignInboxLeadParams): Promise<ApolloClient.MutateResult<MutateAssignInboxLeadResponse>> => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
