import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { ContentConfigurationQuery } from "../__generated__/graphql"

/** The generated payload of the `contentConfiguration` query. */
type QueryContentConfigurationResponse = ContentConfigurationQuery

type Document = TypedDocumentNode<QueryContentConfigurationResponse>

const query1: Document = gql`
    query ContentConfiguration {
        contentConfiguration {
            cadence {
                channel
                days
                id
                postsPerWeek
                time
                workspaceId
            }
            pillars {
                active
                description
                id
                name
                sort
                weight
                workspaceId
            }
            settings {
                automations {
                    offerDraft
                    todayReminder
                    weeklySummary
                }
                avoid
                brandVoice
                cta
                hashtags
                marks {
                    key
                    value
                }
                workspaceId
            }
        }
    }
`

enum QueryContentConfiguration {
    Query1 = "query1",
}

const queryMap: Record<QueryContentConfiguration, Document> = {
    [QueryContentConfiguration.Query1]: query1,
}

/** Apollo options for the `contentConfiguration` query. */
type QueryContentConfigurationParams = QueryParams<QueryContentConfiguration>

/** Runs `contentConfiguration` through the authenticated back end GraphQL API. */
export const queryContentConfiguration = async ({
    query = QueryContentConfiguration.Query1,
    signal,
}: QueryContentConfigurationParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], fetchPolicy: "no-cache" })
}
