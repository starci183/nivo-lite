import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { WebhookEventsQuery } from "../__generated__/graphql"

/** The response of the `webhookEvents` query: the typed payload straight from the back end contract. */
type QueryWebhookEventsResponse = WebhookEventsQuery

const query1: TypedDocumentNode<QueryWebhookEventsResponse> = gql`
    query WebhookEvents {
        webhookEvents {
            id
            label {
                vi
                en
            }
            summary {
                vi
                en
            }
        }
    }
`

enum QueryWebhookEvents {
    Query1 = "query1",
}

const queryMap: Record<QueryWebhookEvents, TypedDocumentNode<QueryWebhookEventsResponse>> = {
    [QueryWebhookEvents.Query1]: query1,
}

/** Apollo params for {@link queryWebhookEvents}. */
type QueryWebhookEventsParams = QueryParams<QueryWebhookEvents>

/** The outgoing events a webhook receiver may pick (the installed plugins' and the engine's own), each with its name. Rejects with the back end failure. */
export const queryWebhookEvents = async ({
    query = QueryWebhookEvents.Query1,
    signal,
}: QueryWebhookEventsParams = {}): Promise<ApolloClient.QueryResult<QueryWebhookEventsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
    })
}
