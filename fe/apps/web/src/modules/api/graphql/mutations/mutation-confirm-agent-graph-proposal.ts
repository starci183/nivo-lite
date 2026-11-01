import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    ConfirmAgentGraphProposalMutation,
    ConfirmAgentGraphProposalMutationVariables,
} from "../__generated__/graphql"

/** The input of the `confirmAgentGraphProposal` mutation. */
type MutateConfirmAgentGraphProposalRequest = WireInput<ConfirmAgentGraphProposalMutationVariables["input"]>

/** The response of the `confirmAgentGraphProposal` mutation: the typed payload straight from the back end contract. */
type MutateConfirmAgentGraphProposalResponse = ConfirmAgentGraphProposalMutation

type Document = TypedDocumentNode<
    MutateConfirmAgentGraphProposalResponse,
    InputVariables<MutateConfirmAgentGraphProposalRequest>
>

const mutation1: Document = gql`
    mutation ConfirmAgentGraphProposal($input: ConfirmAgentGraphProposalInput!) {
        confirmAgentGraphProposal(input: $input) {
            id
            version
        }
    }
`

enum MutationConfirmAgentGraphProposal {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationConfirmAgentGraphProposal, Document> = {
    [MutationConfirmAgentGraphProposal.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateConfirmAgentGraphProposal}. */
type MutateConfirmAgentGraphProposalParams = MutateParams<
    MutationConfirmAgentGraphProposal,
    MutateConfirmAgentGraphProposalRequest
>

/** The back end `confirmAgentGraphProposal` mutation. */
export const mutateConfirmAgentGraphProposal = async ({
    mutation = MutationConfirmAgentGraphProposal.Mutation1,
    request,
    signal,
}: MutateConfirmAgentGraphProposalParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
