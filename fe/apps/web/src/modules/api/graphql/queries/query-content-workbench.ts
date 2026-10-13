import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { ContentWorkbenchQuery } from "../__generated__/graphql"

/** The generated payload of the `contentWorkbench` query. */
type QueryContentWorkbenchResponse = ContentWorkbenchQuery

type Document = TypedDocumentNode<QueryContentWorkbenchResponse>

const query1: Document = gql`
    query ContentWorkbench {
        contentWorkbench {
            actor {
                canManage
                name
                workspaceId
            }
            canManage
            figures {
                awaitingApproval
                next {
                    at
                    title
                }
                pillars {
                    covered
                    total
                }
                published30
            }
            items {
                approvedAt
                approvedBy
                brief
                channels
                createdAt
                createdBy
                draftedAt
                evidence {
                    at
                    by
                    kind
                    text
                }
                hashtags
                holidayKey
                id
                links {
                    label
                    url
                }
                media {
                    id
                    kind
                    name
                    path
                    suggested
                }
                pillarId
                planId
                published {
                    at
                    by
                    channel
                    how
                    url
                }
                publishedAt
                scheduledAt
                source
                status
                title
                updatedAt
                variants {
                    channel
                    hashtags
                    note
                    text
                }
                workItemId
                workspaceId
            }
            lastPlan {
                createdAt
                ideas
                month
                ms
            }
            nowIso
            workspaceId
        }
    }
`

enum QueryContentWorkbench {
    Query1 = "query1",
}

const queryMap: Record<QueryContentWorkbench, Document> = {
    [QueryContentWorkbench.Query1]: query1,
}

/** Apollo options for the `contentWorkbench` query. */
type QueryContentWorkbenchParams = QueryParams<QueryContentWorkbench>

/** Runs `contentWorkbench` through the authenticated back end GraphQL API. */
export const queryContentWorkbench = async ({
    query = QueryContentWorkbench.Query1,
    signal,
}: QueryContentWorkbenchParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], fetchPolicy: "no-cache" })
}
