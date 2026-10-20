import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { MutateParams } from "../types"
import type { PostMarketingWeeklyReportMutation } from "../__generated__/graphql"

type Document = TypedDocumentNode<PostMarketingWeeklyReportMutation, Record<string, never>>

const mutation1: Document = gql`
    mutation PostMarketingWeeklyReport {
        postMarketingWeeklyReport {
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
        }
    }
`

enum MutationPostMarketingWeeklyReport {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationPostMarketingWeeklyReport, Document> = {
    [MutationPostMarketingWeeklyReport.Mutation1]: mutation1,
}

/** Apollo params for {@link mutatePostMarketingWeeklyReport}. */
type MutatePostMarketingWeeklyReportParams = Omit<MutateParams<MutationPostMarketingWeeklyReport, undefined>, "request">

/** Syncs the Meta insights and posts the last week's marketing report as a card in the Marketing room (no input). */
export const mutatePostMarketingWeeklyReport = async ({
    mutation = MutationPostMarketingWeeklyReport.Mutation1,
    signal,
}: MutatePostMarketingWeeklyReportParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation] })
}
