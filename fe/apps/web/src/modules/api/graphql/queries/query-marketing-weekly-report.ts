import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { MarketingWeeklyReportQuery, MarketingWeeklyReportQueryVariables } from "../__generated__/graphql"

/** Generated input of the `marketingWeeklyReport` query. */
type QueryMarketingWeeklyReportRequest = WireInput<MarketingWeeklyReportQueryVariables["input"]>

type Document = TypedDocumentNode<MarketingWeeklyReportQuery, InputVariables<QueryMarketingWeeklyReportRequest>>

const query1: Document = gql`
    query MarketingWeeklyReport($input: MarketingReportInput!) {
        marketingWeeklyReport(input: $input) {
            weekStart
            weekEnd
            reach {
                value
                previous
                changePct
            }
            engagements {
                value
                previous
                changePct
            }
            messages {
                value
                previous
                changePct
            }
            days {
                day
                channels {
                    channel
                    value
                }
            }
            channels
            posts {
                id
                channel
                title
                publishedAt
                engagements
                href
            }
            postCount
            suggestion {
                title
                body
                sources {
                    layer
                    kind
                    ref
                    label
                }
            }
        }
    }
`

enum QueryMarketingWeeklyReport {
    Query1 = "query1",
}

const queryMap: Record<QueryMarketingWeeklyReport, Document> = {
    [QueryMarketingWeeklyReport.Query1]: query1,
}

/** Apollo options for one week of the marketing report. */
type QueryMarketingWeeklyReportParams = QueryParams<QueryMarketingWeeklyReport, QueryMarketingWeeklyReportRequest> & {
    request: QueryMarketingWeeklyReportRequest
}

/** Reads the weekly marketing report (reach, engagements, messages, the engagements per day and channel, the top posts and the suggestion). */
export const queryMarketingWeeklyReport = async ({
    query = QueryMarketingWeeklyReport.Query1,
    request,
    signal,
}: QueryMarketingWeeklyReportParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "network-only" })
}
