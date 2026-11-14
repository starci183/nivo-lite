import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type {
    DeclineAgentGraphProposalMutation,
    DeclineAgentGraphProposalMutationVariables,
} from "../__generated__/graphql"

/** The input of the `declineAgentGraphProposal` mutation. */
type MutateDeclineAgentGraphProposalRequest = WireInput<DeclineAgentGraphProposalMutationVariables["input"]>

/** The response of the `declineAgentGraphProposal` mutation: the typed payload straight from the back end contract. */
type MutateDeclineAgentGraphProposalResponse = DeclineAgentGraphProposalMutation

type Document = TypedDocumentNode<
    MutateDeclineAgentGraphProposalResponse,
    InputVariables<MutateDeclineAgentGraphProposalRequest>
>

const mutation1: Document = gql`
    mutation DeclineAgentGraphProposal($input: DeclineAgentGraphProposalInput!) {
        declineAgentGraphProposal(input: $input)
    }
`

enum MutationDeclineAgentGraphProposal {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDeclineAgentGraphProposal, Document> = {
    [MutationDeclineAgentGraphProposal.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDeclineAgentGraphProposal}. */
type MutateDeclineAgentGraphProposalParams = MutateParams<
    MutationDeclineAgentGraphProposal,
    MutateDeclineAgentGraphProposalRequest
>

/** The back end `declineAgentGraphProposal` mutation. */
export const mutateDeclineAgentGraphProposal = async ({
    mutation = MutationDeclineAgentGraphProposal.Mutation1,
    request,
    signal,
}: MutateDeclineAgentGraphProposalParams): Promise<
    ApolloClient.MutateResult<MutateDeclineAgentGraphProposalResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
