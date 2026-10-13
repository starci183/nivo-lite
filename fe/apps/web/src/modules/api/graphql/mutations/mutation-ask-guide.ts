import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AskGuideMutation, AskGuideMutationVariables } from "../__generated__/graphql"

/** The input of the `askGuide` mutation. */
type MutateAskGuideRequest = WireInput<AskGuideMutationVariables["input"]>

/** The response of the `askGuide` mutation. */
type MutateAskGuideResponse = AskGuideMutation

type Document = TypedDocumentNode<MutateAskGuideResponse, InputVariables<MutateAskGuideRequest>>

const mutation1: Document = gql`
    mutation AskGuide($input: AskGuideInput!) {
        askGuide(input: $input) {
            generationId
            status
        }
    }
`

enum MutationAskGuide {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationAskGuide, Document> = {
    [MutationAskGuide.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAskGuide}. */
type MutateAskGuideParams = MutateParams<MutationAskGuide, MutateAskGuideRequest>

/** Queues the NIVO guide's answer to one question (the be builds the prompt); poll it with `agentGenerationStatus`. */
export const mutateAskGuide = async ({
    mutation = MutationAskGuide.Mutation1,
    request,
    signal,
}: MutateAskGuideParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
