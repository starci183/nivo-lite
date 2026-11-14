import { gql, type TypedDocumentNode, type ApolloClient } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { BillingPlansQuery } from "../__generated__/graphql"

type QueryBillingPlansResponse = BillingPlansQuery

const query1: TypedDocumentNode<QueryBillingPlansResponse> = gql`
    query BillingPlans {
        billingPlans {
            code
            nameVi
            nameEn
            priceVnd
            period
            seats
            features {
                vi
                en
            }
            sort
            aiCreditsPerMonth
            isCustom
            priceAnnualVnd
            annualDiscountPct
            promoPriceVnd
            promoMonths
            storageGb
            individual
            perSeat
            listed
            tiers {
                creditsPerMonth
                priceVnd
                perSeat
            }
            packs {
                creditsPerMonth
                priceVnd
                perSeat
            }
        }
    }
`

enum QueryBillingPlans {
    Query1 = "query1",
}
const queryMap: Record<QueryBillingPlans, typeof query1> = { [QueryBillingPlans.Query1]: query1 }

/** Calls the backend billingPlans query. */
export const queryBillingPlans = async ({
    query = QueryBillingPlans.Query1,
    signal,
}: QueryParams<QueryBillingPlans> = {}): Promise<ApolloClient.QueryResult<QueryBillingPlansResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
    })
}
