import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { DossierFindingsQuery, DossierFindingsQueryVariables } from "../__generated__/graphql"

/** The variables of the `dossierFindings` query as a caller writes them: the filter and the page asked for. */
export type QueryDossierFindingsRequest = WireInput<NonNullable<DossierFindingsQueryVariables["input"]>>
type Document = TypedDocumentNode<DossierFindingsQuery, InputVariables<QueryDossierFindingsRequest>>

const query1: Document = gql`
    query DossierFindings($input: DossierFindingsInput) {
        dossierFindings(input: $input) {
            nodes {
                id
                dossierId
                dossierRef
                dossierName
                kind
                severity
                origin
                title
                detail
                evidence {
                    role
                    label
                    sourceId
                    sourceTitle
                    factLine
                    quote
                    placeKind
                    placeLabel
                }
                remedyAction
                remedyDocumentType
                status
                resolution
                dismissReason
                decisionNote
                assigneeId
                dueAt
                draftId
                draftStatus
                lastSeenAt
                resolvedAt
                decidedAt
            }
            pageInfo {
                endCursor
                hasNextPage
            }
        }
    }
`

enum QueryDossierFindings {
    Query1 = "query1",
}

const queryMap: Record<QueryDossierFindings, Document> = {
    [QueryDossierFindings.Query1]: query1,
}

type QueryDossierFindingsParams = QueryParams<QueryDossierFindings, QueryDossierFindingsRequest>

/** Reads one forward page of the findings of the dossier review of the selected workspace (the back end `dossierFindings` query). */
export const queryDossierFindings = async ({
    query = QueryDossierFindings.Query1,
    request = {},
    signal,
    headers,
}: QueryDossierFindingsParams = {}) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        context: { headers },
        fetchPolicy: "no-cache",
    })
}
