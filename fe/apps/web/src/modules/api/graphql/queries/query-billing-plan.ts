import { gql, type TypedDocumentNode, type ApolloClient } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
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
}: QueryBillingPlanParams): Promise<ApolloClient.QueryResult<QueryBillingPlanResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
