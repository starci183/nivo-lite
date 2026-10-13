import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationCancelHiringOfferArgs } from "../__generated__/schema"

/** The input of the `cancelHiringOffer` mutation. */
export type MutateCancelHiringOfferRequest = MutationCancelHiringOfferArgs["input"]

/** The response of the `cancelHiringOffer` mutation. */
type MutateCancelHiringOfferResponse = Pick<Mutation, "cancelHiringOffer">

const mutation1: TypedDocumentNode<
    MutateCancelHiringOfferResponse,
    InputVariables<MutateCancelHiringOfferRequest>
> = gql`
    mutation CancelHiringOffer($input: HiringOfferRefInput!) {
        cancelHiringOffer(input: $input)
    }
`

enum MutationCancelHiringOffer {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCancelHiringOffer,
    TypedDocumentNode<MutateCancelHiringOfferResponse, InputVariables<MutateCancelHiringOfferRequest>>
> = {
    [MutationCancelHiringOffer.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCancelHiringOffer}. */
type MutateCancelHiringOfferParams = MutateParams<MutationCancelHiringOffer, MutateCancelHiringOfferRequest>

/** Runs the `cancelHiringOffer` mutation. */
export const mutateCancelHiringOffer = async ({
    mutation = MutationCancelHiringOffer.Mutation1,
    request,
    signal,
}: MutateCancelHiringOfferParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
