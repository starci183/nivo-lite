import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRequestHiringOfferArgs } from "../__generated__/schema"

/** The input of the `requestHiringOffer` mutation. */
export type MutateRequestHiringOfferRequest = MutationRequestHiringOfferArgs["input"]

/** The response of the `requestHiringOffer` mutation. */
type MutateRequestHiringOfferResponse = Pick<Mutation, "requestHiringOffer">

const mutation1: TypedDocumentNode<
    MutateRequestHiringOfferResponse,
    InputVariables<MutateRequestHiringOfferRequest>
> = gql`
    mutation RequestHiringOffer($input: RequestHiringOfferInput!) {
        requestHiringOffer(input: $input) {
            error
            status
            summary
        }
    }
`

enum MutationRequestHiringOffer {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRequestHiringOffer,
    TypedDocumentNode<MutateRequestHiringOfferResponse, InputVariables<MutateRequestHiringOfferRequest>>
> = {
    [MutationRequestHiringOffer.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestHiringOffer}. */
type MutateRequestHiringOfferParams = MutateParams<MutationRequestHiringOffer, MutateRequestHiringOfferRequest>

/** Runs the `requestHiringOffer` mutation. */
export const mutateRequestHiringOffer = async ({
    mutation = MutationRequestHiringOffer.Mutation1,
    request,
    signal,
}: MutateRequestHiringOfferParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
