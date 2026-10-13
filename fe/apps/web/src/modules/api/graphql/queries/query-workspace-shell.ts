import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { WorkspaceShellQuery, WorkspaceShellQueryVariables } from "../__generated__/graphql"

/** The input of the `workspaceShell` query. */
export type QueryWorkspaceShellRequest = WireInput<WorkspaceShellQueryVariables["input"]>

/** The response of the `workspaceShell` query: the typed payload straight from the back end contract. */
type QueryWorkspaceShellResponse = WorkspaceShellQuery

type Document = TypedDocumentNode<QueryWorkspaceShellResponse, InputVariables<QueryWorkspaceShellRequest>>

const query1: Document = gql`
    query WorkspaceShell($input: ShellWindowInput!) {
        workspaceShell(input: $input) {
            agents {
                id
                module
                name
                status
            }
            approvals {
                contactName
                draft
                id
                leadId
                nextAction
            }
            exceptions {
                contactName
                error
                id
                leadId
                summary
            }
            hasChatbot
            isFoundingMember
            leadCount
            openResponsibilityCount
            pendingDecisions
        }
    }
`

enum QueryWorkspaceShell {
    Query1 = "query1",
}

const queryMap: Record<QueryWorkspaceShell, Document> = {
    [QueryWorkspaceShell.Query1]: query1,
}

/** Apollo params for {@link queryWorkspaceShell}. */
type QueryWorkspaceShellParams = QueryParams<QueryWorkspaceShell, QueryWorkspaceShellRequest> & {
    request: QueryWorkspaceShellRequest
}

/** Everything the console frame draws, in one read (the back end `workspaceShell` query). Rejects with the back end failure instead of answering partial data. */
export const queryWorkspaceShell = async ({
    query = QueryWorkspaceShell.Query1,
    request,
    signal,
}: QueryWorkspaceShellParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
