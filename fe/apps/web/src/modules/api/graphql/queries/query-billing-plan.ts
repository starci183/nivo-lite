import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { BillingPlanQuery, BillingPlanQueryVariables } from "../__generated__/graphql"

type QueryBillingPlanRequest = WireInput<BillingPlanQueryVariables["input"]>
type QueryBillingPlanResponse = BillingPlanQuery

type QueryBillingPlanParams = QueryParams<QueryBillingPlan, QueryBillingPlanRequest> & {
    request: QueryBillingPlanRequest
}

const query1: TypedDocumentNode<QueryBillingPlanResponse, InputVariables<QueryBillingPlanRequest>> = gql`
    query BillingPlan($input: BillingPlanInput!) {
        billingPlan(input: $input) {
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

enum QueryBillingPlan {
    Query1 = "query1",
}
const queryMap: Record<QueryBillingPlan, typeof query1> = { [QueryBillingPlan.Query1]: query1 }

/** Calls the backend billingPlan query. */
export const queryBillingPlan = async ({
    query = QueryBillingPlan.Query1,
    request,
    signal,
}: QueryBillingPlanParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
