import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { BrainFactsPageQuery, BrainFactsPageQueryVariables } from "../__generated__/graphql"

/** The page asked of the facts list: size, cursor, statuses, one document, a subject type, words (every field optional). */
export type QueryBrainFactsPageRequest = NonNullable<BrainFactsPageQueryVariables["facts"]>

type Document = TypedDocumentNode<BrainFactsPageQuery, BrainFactsPageQueryVariables>

const query1: Document = gql`
    query BrainFactsPage($facts: BrainFactsPageInput) {
        brain(facts: $facts) {
            factsTotal
            factsNextCursor
            facts {
                attribute
                attributeLabel
                decidedAt
                decidedBy
                decisionNote
                evidence {
                    at
                    kind
                    label
                    quote
                    ref
                    sourceId
                    sourceTitle
                }
                id
                installationId
                modules
                proposalKind
                proposedAt
                proposedBy
                scope
                sourceKind
                status
                subjectKey
                subjectLabel
                subjectType
                trust
                unit
                validFrom
                validTo
                value
            }
        }
    }
`

enum QueryBrainFactsPageDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryBrainFactsPageDocument, Document> = {
    [QueryBrainFactsPageDocument.Query1]: query1,
}

type QueryBrainFactsPageParams = QueryParams<QueryBrainFactsPageDocument, QueryBrainFactsPageRequest> & {
    request: QueryBrainFactsPageRequest
}

/** One server-side page of the Second Brain facts (filters and cursor done by the back end; `factsTotal` counts every match). Rejects with the back end failure. */
export const queryBrainFactsPage = async ({
    query = QueryBrainFactsPageDocument.Query1,
    request,
    signal,
}: QueryBrainFactsPageParams): Promise<ApolloClient.QueryResult<BrainFactsPageQuery>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { facts: request }, fetchPolicy: "no-cache" })
}
