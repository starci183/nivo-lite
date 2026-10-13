import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { PublicHiringOfferQuery, PublicHiringOfferQueryVariables } from "../__generated__/graphql"

/** The input of the `publicHiringOffer` query. */
export type QueryPublicHiringOfferRequest = WireInput<PublicHiringOfferQueryVariables["input"]>

/** The response of the `publicHiringOffer` query. */
type QueryPublicHiringOfferResponse = PublicHiringOfferQuery

const query1: TypedDocumentNode<QueryPublicHiringOfferResponse, InputVariables<QueryPublicHiringOfferRequest>> = gql`
    query PublicHiringOffer($input: HiringTokenInput!) {
        publicHiringOffer(input: $input) {
            candidateName
            expiresAt
            jobTitle
            letter
            location
            shop
            status
            terms {
                note
                pay
                probation
                startDate
                title
            }
        }
    }
`

enum QueryPublicHiringOffer {
    Query1 = "query1",
}

const queryMap: Record<
    QueryPublicHiringOffer,
    TypedDocumentNode<QueryPublicHiringOfferResponse, InputVariables<QueryPublicHiringOfferRequest>>
> = {
    [QueryPublicHiringOffer.Query1]: query1,
}

/** Apollo params for {@link queryPublicHiringOffer}. */
type QueryPublicHiringOfferParams = QueryParams<QueryPublicHiringOffer, QueryPublicHiringOfferRequest> & {
    request: QueryPublicHiringOfferRequest
}

/** Runs the `publicHiringOffer` query (anonymous public door). */
export const queryPublicHiringOffer = async ({
    query = QueryPublicHiringOffer.Query1,
    request,
    signal,
}: QueryPublicHiringOfferParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
