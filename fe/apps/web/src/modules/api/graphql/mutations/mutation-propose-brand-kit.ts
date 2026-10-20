import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ProposeBrandKitMutation, ProposeBrandKitMutationVariables } from "../__generated__/graphql"

/** Generated input of the `proposeBrandKit` mutation. */
type MutateProposeBrandKitRequest = WireInput<ProposeBrandKitMutationVariables["input"]>

type Document = TypedDocumentNode<ProposeBrandKitMutation, InputVariables<MutateProposeBrandKitRequest>>

const mutation1: Document = gql`
    mutation ProposeBrandKit($input: ProposeBrandKitInput!) {
        proposeBrandKit(input: $input) {
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

enum MutationProposeBrandKit {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationProposeBrandKit, Document> = {
    [MutationProposeBrandKit.Mutation1]: mutation1,
}

/** Apollo options for {@link mutateProposeBrandKit}. */
type MutateProposeBrandKitParams = MutateParams<MutationProposeBrandKit, MutateProposeBrandKitRequest>

/** Reads an attached brand guideline PDF into a brand proposal waiting for the owner. */
export const mutateProposeBrandKit = async ({
    mutation = MutationProposeBrandKit.Mutation1,
    request,
    signal,
}: MutateProposeBrandKitParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
