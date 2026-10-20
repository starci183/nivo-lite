import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DecideBrandProposalMutation, DecideBrandProposalMutationVariables } from "../__generated__/graphql"

/** Generated input of the `decideBrandProposal` mutation. */
type MutateDecideBrandProposalRequest = WireInput<DecideBrandProposalMutationVariables["input"]>

type Document = TypedDocumentNode<DecideBrandProposalMutation, InputVariables<MutateDecideBrandProposalRequest>>

const mutation1: Document = gql`
    mutation DecideBrandProposal($input: DecideBrandProposalInput!) {
        decideBrandProposal(input: $input) {
            id
            installationId
            setupSessionId
            fileName
            fileSize
            status
            decidedBy
            createdAt
            kit {
                brandName
                colors {
                    name
                    hex
                }
                fonts
                tone
                address
                imagery
                avoid
            }
        }
    }
`

enum MutationDecideBrandProposal {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDecideBrandProposal, Document> = {
    [MutationDecideBrandProposal.Mutation1]: mutation1,
}

/** Apollo options for {@link mutateDecideBrandProposal}. */
type MutateDecideBrandProposalParams = MutateParams<MutationDecideBrandProposal, MutateDecideBrandProposalRequest>

/** Confirms (with the owner's edits) or rejects a brand proposal. */
export const mutateDecideBrandProposal = async ({
    mutation = MutationDecideBrandProposal.Mutation1,
    request,
    signal,
}: MutateDecideBrandProposalParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
