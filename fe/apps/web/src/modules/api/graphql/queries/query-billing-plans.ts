import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

type QueryBillingPlansResponse = Pick<Query, "billingPlans">

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
}: QueryParams<QueryBillingPlans> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
