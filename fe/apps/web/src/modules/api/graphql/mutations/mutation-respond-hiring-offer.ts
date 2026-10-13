import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RespondHiringOfferMutation, RespondHiringOfferMutationVariables } from "../__generated__/graphql"

/** The input of the `respondHiringOffer` mutation. */
export type MutateRespondHiringOfferRequest = WireInput<RespondHiringOfferMutationVariables["input"]>

/** The response of the `respondHiringOffer` mutation. */
type MutateRespondHiringOfferResponse = RespondHiringOfferMutation

const mutation1: TypedDocumentNode<
    MutateRespondHiringOfferResponse,
    InputVariables<MutateRespondHiringOfferRequest>
> = gql`
    mutation RespondHiringOffer($input: RespondHiringOfferInput!) {
        respondHiringOffer(input: $input) {
            outcome
        }
    }
`

enum MutationRespondHiringOffer {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRespondHiringOffer,
    TypedDocumentNode<MutateRespondHiringOfferResponse, InputVariables<MutateRespondHiringOfferRequest>>
> = {
    [MutationRespondHiringOffer.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRespondHiringOffer}. */
type MutateRespondHiringOfferParams = MutateParams<MutationRespondHiringOffer, MutateRespondHiringOfferRequest>

/** Runs the `respondHiringOffer` mutation (anonymous public door). */
export const mutateRespondHiringOffer = async ({
    mutation = MutationRespondHiringOffer.Mutation1,
    request,
    signal,
}: MutateRespondHiringOfferParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
