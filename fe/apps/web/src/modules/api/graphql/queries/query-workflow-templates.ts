import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { WorkflowTemplatesQuery, WorkflowTemplatesQueryVariables } from "../__generated__/graphql"

/** The input of the `workflowTemplates` query. */
export type QueryWorkflowTemplatesRequest = WireInput<WorkflowTemplatesQueryVariables["input"]>

type WorkflowTemplatesQueryResponse = WorkflowTemplatesQuery

const query1: TypedDocumentNode<WorkflowTemplatesQueryResponse, InputVariables<QueryWorkflowTemplatesRequest>> = gql`
    query WorkflowTemplates($input: WorkflowTemplatesInput!) {
        workflowTemplates(input: $input) { id moduleKey primary name summary latestVersion shops requires { kind label why } versions { version publishedAt changes stepCount } graphJson }
    }
`

enum QueryWorkflowTemplates {
    Query1 = "query1",
}

const queryMap: Record<QueryWorkflowTemplates, TypedDocumentNode<WorkflowTemplatesQueryResponse, InputVariables<QueryWorkflowTemplatesRequest>>> = {
    [QueryWorkflowTemplates.Query1]: query1,
}

type QueryWorkflowTemplatesParams = QueryParams<QueryWorkflowTemplates, QueryWorkflowTemplatesRequest> & {
    request: QueryWorkflowTemplatesRequest
}

/** The back end `workflowTemplates` query. The workflow templates of the market. Rejects with the back end failure (message localized by the server). */
export const queryWorkflowTemplates = async ({
    query = QueryWorkflowTemplates.Query1,
    request,
    signal,
}: QueryWorkflowTemplatesParams): Promise<ApolloClient.QueryResult<WorkflowTemplatesQueryResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
