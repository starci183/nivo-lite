import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { DossierReviewSummaryQuery } from "../__generated__/graphql"

/** The response of the `dossierReviewSummary` query: the typed payload straight from the back end contract. */
type QueryDossierReviewSummaryResponse = DossierReviewSummaryQuery

type Document = TypedDocumentNode<QueryDossierReviewSummaryResponse, Record<string, never>>

const query1: Document = gql`
    query DossierReviewSummary {
        dossierReviewSummary {
            open
            confirmed
            critical
            high
            draftsAwaiting
            isRunning
            latestRun {
                id
                scope
                dossierId
                trigger
                status
                aiState
                opened
                resolved
                dropped
                startedAt
                finishedAt
                createdAt
            }
            dossiers {
                dossierId
                status
                checklistStatus
                openCount
                criticalCount
                highCount
                reviewedAt
            }
        }
    }
`

enum QueryDossierReviewSummary {
    Query1 = "query1",
}

const queryMap: Record<QueryDossierReviewSummary, Document> = { [QueryDossierReviewSummary.Query1]: query1 }

/** Calls the back end dossierReviewSummary query: what the review found in the workspace, whether a run is going and the status it computed per dossier. */
export const queryDossierReviewSummary = async ({
    query = QueryDossierReviewSummary.Query1,
    signal,
}: QueryParams<QueryDossierReviewSummary> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
