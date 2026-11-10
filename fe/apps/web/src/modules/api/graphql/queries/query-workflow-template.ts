import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { WorkflowTemplateQuery, WorkflowTemplateQueryVariables } from "../__generated__/graphql"

/** The input of the `workflowTemplate` query. */
export type QueryWorkflowTemplateRequest = WireInput<WorkflowTemplateQueryVariables["input"]>

type WorkflowTemplateQueryResponse = WorkflowTemplateQuery

const query1: TypedDocumentNode<WorkflowTemplateQueryResponse, InputVariables<QueryWorkflowTemplateRequest>> = gql`
    query WorkflowTemplate($input: WorkflowTemplateInput!) {
        workflowTemplate(input: $input) { id moduleKey primary name summary latestVersion shops requires { kind label why } versions { version publishedAt changes stepCount } graphJson }
    }
`

enum QueryWorkflowTemplate {
    Query1 = "query1",
}

const queryMap: Record<QueryWorkflowTemplate, TypedDocumentNode<WorkflowTemplateQueryResponse, InputVariables<QueryWorkflowTemplateRequest>>> = {
    [QueryWorkflowTemplate.Query1]: query1,
}

type QueryWorkflowTemplateParams = QueryParams<QueryWorkflowTemplate, QueryWorkflowTemplateRequest> & {
    request: QueryWorkflowTemplateRequest
}

/** The back end `workflowTemplate` query. One workflow template. Rejects with the back end failure (message localized by the server). */
export const queryWorkflowTemplate = async ({
    query = QueryWorkflowTemplate.Query1,
    request,
    signal,
}: QueryWorkflowTemplateParams): Promise<ApolloClient.QueryResult<WorkflowTemplateQueryResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
