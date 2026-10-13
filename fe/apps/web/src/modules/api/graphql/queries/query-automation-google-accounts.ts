import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `automationGoogleAccounts` query: the typed payload straight from the back end contract. */
type QueryAutomationGoogleAccountsResponse = Pick<Query, "automationGoogleAccounts">

const query1: TypedDocumentNode<QueryAutomationGoogleAccountsResponse> = gql`
    query AutomationGoogleAccounts {
        automationGoogleAccounts {
            id
            email
            status
        }
    }
`

enum QueryAutomationGoogleAccounts {
    Query1 = "query1",
}

const queryMap: Record<QueryAutomationGoogleAccounts, TypedDocumentNode<QueryAutomationGoogleAccountsResponse>> = {
    [QueryAutomationGoogleAccounts.Query1]: query1,
}

/** Apollo params for {@link queryAutomationGoogleAccounts}. */
type QueryAutomationGoogleAccountsParams = QueryParams<QueryAutomationGoogleAccounts>

/**
 * Lists the Google accounts of the active workspace a spreadsheet automation can write with (the back end
 * `automationGoogleAccounts` query). Rejects with the back end failure instead of answering partial data.
 */
export const queryAutomationGoogleAccounts = async ({
    query = QueryAutomationGoogleAccounts.Query1,
    signal,
}: QueryAutomationGoogleAccountsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
