import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentWorkflowTemplatePreviewQuery, AgentWorkflowTemplatePreviewQueryVariables } from "../__generated__/graphql"

/** The input of the `agentWorkflowTemplatePreview` query. */
export type QueryAgentWorkflowTemplatePreviewRequest = WireInput<AgentWorkflowTemplatePreviewQueryVariables["input"]>

type AgentWorkflowTemplatePreviewQueryResponse = AgentWorkflowTemplatePreviewQuery

const query1: TypedDocumentNode<AgentWorkflowTemplatePreviewQueryResponse, InputVariables<QueryAgentWorkflowTemplatePreviewRequest>> = gql`
    query AgentWorkflowTemplatePreview($input: AgentWorkflowTemplatePreviewInput!) {
        agentWorkflowTemplatePreview(input: $input) { templateVersion changes { version lines } conflicts diff { steps { key change step parts params { name beforeJson afterJson } } triggerChanged nodeRightsAdded { nodeKey kind provider connectionId operation mode } nodeRightsRemoved { nodeKey kind provider connectionId operation mode } nodeRightsLoosened { nodeKey kind provider connectionId operation mode } toolsAdded toolsRemoved effectsAdded effectsRemoved beforeJson afterJson } }
    }
`

enum QueryAgentWorkflowTemplatePreview {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentWorkflowTemplatePreview, TypedDocumentNode<AgentWorkflowTemplatePreviewQueryResponse, InputVariables<QueryAgentWorkflowTemplatePreviewRequest>>> = {
    [QueryAgentWorkflowTemplatePreview.Query1]: query1,
}

type QueryAgentWorkflowTemplatePreviewParams = QueryParams<QueryAgentWorkflowTemplatePreview, QueryAgentWorkflowTemplatePreviewRequest> & {
    request: QueryAgentWorkflowTemplatePreviewRequest
}

/** The back end `agentWorkflowTemplatePreview` query. What accepting a newer template version would write. Rejects with the back end failure (message localized by the server). */
export const queryAgentWorkflowTemplatePreview = async ({
    query = QueryAgentWorkflowTemplatePreview.Query1,
    request,
    signal,
}: QueryAgentWorkflowTemplatePreviewParams): Promise<ApolloClient.QueryResult<AgentWorkflowTemplatePreviewQueryResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
