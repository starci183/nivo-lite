import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { DossierRemedyDraftQuery, DossierRemedyDraftQueryVariables } from "../__generated__/graphql"

/** The response of the `dossierRemedyDraft` query: the typed payload straight from the back end contract. */
type QueryDossierRemedyDraftResponse = DossierRemedyDraftQuery

/** The variables of the `dossierRemedyDraft` query. */
type QueryDossierRemedyDraftRequest = DossierRemedyDraftQueryVariables

type Document = TypedDocumentNode<QueryDossierRemedyDraftResponse, QueryDossierRemedyDraftRequest>

const query1: Document = gql`
    query DossierRemedyDraft($input: DossierRemedyDraftRefInput!) {
        dossierRemedyDraft(input: $input) {
            id
            findingId
            dossierId
            status
            title
            documentType
            body
            placeholders {
                label
                reason
            }
            error
            sourceId
            instructions
            rejectReason
            decidedAt
            createdAt
            updatedAt
        }
    }
`

enum QueryDossierRemedyDraft {
    Query1 = "query1",
}

const queryMap: Record<QueryDossierRemedyDraft, Document> = { [QueryDossierRemedyDraft.Query1]: query1 }

/** Apollo params for {@link queryDossierRemedyDraft}. */
interface QueryDossierRemedyDraftParams extends QueryParams<QueryDossierRemedyDraft, QueryDossierRemedyDraftRequest> {
    request: QueryDossierRemedyDraftRequest
}

/** Reads one remedy draft of the workspace (the back end `dossierRemedyDraft` query); null when it is not there. */
export const queryDossierRemedyDraft = async ({
    query = QueryDossierRemedyDraft.Query1,
    request,
    signal,
}: QueryDossierRemedyDraftParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: request,
    })
}
