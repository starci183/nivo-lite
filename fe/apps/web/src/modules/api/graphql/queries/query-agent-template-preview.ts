import { gql } from "@apollo/client"
import type { ApolloClient, TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentTemplatePreviewQuery, AgentTemplatePreviewQueryVariables } from "../__generated__/graphql"

/** The input of the `agentTemplatePreview` query. */
export type QueryAgentTemplatePreviewRequest = WireInput<AgentTemplatePreviewQueryVariables["input"]>

type QueryAgentTemplatePreviewResponse = AgentTemplatePreviewQuery

const query1: TypedDocumentNode<
    QueryAgentTemplatePreviewResponse,
    InputVariables<QueryAgentTemplatePreviewRequest>
> = gql`
    query AgentTemplatePreview($input: PackageAgentTemplateInput!) {
        agentTemplatePreview(input: $input) {
            problems
            report {
                nodes
                branches
                brainRefs
                privateSources
                people
                rights
            }
            suggestions {
                parameter
                target
                nodeKey
                branchKey
                termIndex
            }
            package {
                key
                version
                hash
                baseModule
                requiredProviders
                requiredAuthorityActions
                starterKnowledge
                parameters {
                    key
                    kind
                    label {
                        vi
                        en
                    }
                    hint {
                        vi
                        en
                    }
                    min
                    max
                    required
                    defaultValue
                }
                proposedRights {
                    kind
                    scope
                }
                personName
            }
        }
    }
`

enum QueryAgentTemplatePreview {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAgentTemplatePreview,
    TypedDocumentNode<QueryAgentTemplatePreviewResponse, InputVariables<QueryAgentTemplatePreviewRequest>>
> = {
    [QueryAgentTemplatePreview.Query1]: query1,
}

type QueryAgentTemplatePreviewParams = QueryParams<QueryAgentTemplatePreview, QueryAgentTemplatePreviewRequest> & {
    request: QueryAgentTemplatePreviewRequest
}

/** The back end `agentTemplatePreview` query. */
export const queryAgentTemplatePreview = async ({
    query = QueryAgentTemplatePreview.Query1,
    request,
    signal,
}: QueryAgentTemplatePreviewParams): Promise<ApolloClient.QueryResult<QueryAgentTemplatePreviewResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
