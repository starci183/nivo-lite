import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { InboundSimulationStatusQuery, InboundSimulationStatusQueryVariables } from "../__generated__/graphql"

/** The generated input of the simulator status query. */
type QueryInboundSimulationStatusRequest = WireInput<InboundSimulationStatusQueryVariables["input"]>

/** The generated selection returned by the simulator status query. */
type QueryInboundSimulationStatusResponse = InboundSimulationStatusQuery

type Document = TypedDocumentNode<
    QueryInboundSimulationStatusResponse,
    InputVariables<QueryInboundSimulationStatusRequest>
>

const query1: Document = gql`
    query InboundSimulationStatus($input: InboundSimulationStatusInput!) {
        inboundSimulationStatus(input: $input) {
            id
            status
            errorCode
            event {
                id
                eventId
                duplicateCount
                amountVnd
                leadId
                status
            }
            workItem {
                id
                department
                status
            }
        }
    }
`

enum QueryInboundSimulationStatus {
    Query1 = "query1",
}

const queryMap: Record<QueryInboundSimulationStatus, Document> = {
    [QueryInboundSimulationStatus.Query1]: query1,
}

/** Apollo parameters for the simulator status query. */
type QueryInboundSimulationStatusParams = QueryParams<
    QueryInboundSimulationStatus,
    QueryInboundSimulationStatusRequest
> & { request: QueryInboundSimulationStatusRequest }

/** Reads queue progress and the refreshed department result of a simulated delivery. */
export const queryInboundSimulationStatus = async ({
    query = QueryInboundSimulationStatus.Query1,
    request,
    signal,
    headers,
}: QueryInboundSimulationStatusParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
        context: { headers },
    })
}
