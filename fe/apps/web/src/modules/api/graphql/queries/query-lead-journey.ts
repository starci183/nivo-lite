import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryLeadJourneyArgs } from "../__generated__/schema"

/** Generated input of the leadJourney query. */
type QueryLeadJourneyRequest = QueryLeadJourneyArgs["input"]

/** Generated response of the leadJourney query. */
type QueryLeadJourneyResponse = Pick<Query, "leadJourney">

type Document = TypedDocumentNode<QueryLeadJourneyResponse, InputVariables<QueryLeadJourneyRequest>>

const query1: Document = gql`
    query LeadJourney($input: LeadJourneyInput!) {
        leadJourney(input: $input) {
            agents {
                handle
                id
                module
                name
                status
            }
            events {
                actor
                createdAt
                evidence
                id
                kind
                leadId
                summary
            }
            executions {
                agentId
                createdAt
                decidedAt
                decidedBy
                draft
                id
                kind
                responsibilityId
                status
                workItemId
                workspaceId
            }
            lead {
                channel
                company
                contactName
                contextSummary
                createdAt
                id
                installationId
                need
                origin
                stage
            }
            responsibilities {
                createdAt
                dueAt
                id
                leadId
                nextAction
                ownerAgentId
                ownerKind
                ownerName
                status
                title
            }
        }
    }
`

enum QueryLeadJourney {
    Query1 = "query1",
}

const queryMap: Record<QueryLeadJourney, Document> = {
    [QueryLeadJourney.Query1]: query1,
}

/** Apollo parameters for the leadJourney query. */
type QueryLeadJourneyParams = QueryParams<QueryLeadJourney, QueryLeadJourneyRequest> & {
    request: QueryLeadJourneyRequest
}

/** Runs the workspace-scoped leadJourney query through the authenticated GraphQL client. */
export const queryLeadJourney = async ({
    query = QueryLeadJourney.Query1,
    request,
    signal,
    headers,
}: QueryLeadJourneyParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
