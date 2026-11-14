import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentDeletionImpactQuery, AgentDeletionImpactQueryVariables } from "../__generated__/graphql"

/** The response of the `agentDeletionImpact` query: the typed payload straight from the back end contract. */
type QueryAgentDeletionImpactResponse = AgentDeletionImpactQuery

/** The input of the `agentDeletionImpact` query. */
type QueryAgentDeletionImpactRequest = WireInput<AgentDeletionImpactQueryVariables["input"]>

type Document = TypedDocumentNode<QueryAgentDeletionImpactResponse, InputVariables<QueryAgentDeletionImpactRequest>>

const query1: Document = gql`
    query AgentDeletionImpact($input: ModuleInstallationIdInput!) {
        agentDeletionImpact(input: $input) {
            agentId
            files
            installationId
            records
            recordTypes {
                count
                title
                type
            }
        }
    }
`

enum QueryAgentDeletionImpact {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentDeletionImpact, Document> = { [QueryAgentDeletionImpact.Query1]: query1 }

/** Apollo params for {@link queryAgentDeletionImpact}. */
interface QueryAgentDeletionImpactParams extends QueryParams<QueryAgentDeletionImpact, QueryAgentDeletionImpactRequest> {
    request: QueryAgentDeletionImpactRequest
}

/**
 * Reads what removing an agent erases: its records per type and the files they hold (the back end `agentDeletionImpact` query), so the
 * confirmation states the loss before the removal runs.
 */
export const queryAgentDeletionImpact = async ({
    query = QueryAgentDeletionImpact.Query1,
    request,
    signal,
}: QueryAgentDeletionImpactParams): Promise<ApolloClient.QueryResult<QueryAgentDeletionImpactResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
