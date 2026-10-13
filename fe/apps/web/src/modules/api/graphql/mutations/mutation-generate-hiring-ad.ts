import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { GenerateHiringAdMutation, GenerateHiringAdMutationVariables } from "../__generated__/graphql"

/** The input of the `generateHiringAd` mutation. */
export type MutateGenerateHiringAdRequest = WireInput<GenerateHiringAdMutationVariables["input"]>

/** The response of the `generateHiringAd` mutation. */
type MutateGenerateHiringAdResponse = GenerateHiringAdMutation

const mutation1: TypedDocumentNode<MutateGenerateHiringAdResponse, InputVariables<MutateGenerateHiringAdRequest>> = gql`
    mutation GenerateHiringAd($input: HiringJobRefInput!) {
        generateHiringAd(input: $input) {
            attempts
            facebook
            generatedAt
            ms
            sanitised
            topcv
            zalo
        }
    }
`

enum MutationGenerateHiringAd {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationGenerateHiringAd,
    TypedDocumentNode<MutateGenerateHiringAdResponse, InputVariables<MutateGenerateHiringAdRequest>>
> = {
    [MutationGenerateHiringAd.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateGenerateHiringAd}. */
type MutateGenerateHiringAdParams = MutateParams<MutationGenerateHiringAd, MutateGenerateHiringAdRequest>

/** Runs the `generateHiringAd` mutation. */
export const mutateGenerateHiringAd = async ({
    mutation = MutationGenerateHiringAd.Mutation1,
    request,
    signal,
}: MutateGenerateHiringAdParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
