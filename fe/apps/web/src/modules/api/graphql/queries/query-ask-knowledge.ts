import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AskKnowledgeQuery, AskKnowledgeQueryVariables } from "../__generated__/graphql"

/** The response of the `askKnowledge` query: the typed payload straight from the back end contract. */
type QueryAskKnowledgeResponse = AskKnowledgeQuery

/** The input of the `askKnowledge` query. */
type QueryAskKnowledgeRequest = WireInput<AskKnowledgeQueryVariables["input"]>

const query1: TypedDocumentNode<QueryAskKnowledgeResponse, InputVariables<QueryAskKnowledgeRequest>> = gql`
    query AskKnowledge($input: AskKnowledgeInput!) {
        askKnowledge(input: $input) {
            content
            id
            kind
            layer
            module
            order
            score
            sourceId
            title
            topic
            visibility
        }
    }
`

enum QueryAskKnowledge {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAskKnowledge,
    TypedDocumentNode<QueryAskKnowledgeResponse, InputVariables<QueryAskKnowledgeRequest>>
> = {
    [QueryAskKnowledge.Query1]: query1,
}

/** Apollo params for {@link queryAskKnowledge}. */
interface QueryAskKnowledgeParams extends QueryParams<QueryAskKnowledge, QueryAskKnowledgeRequest> {
    request: QueryAskKnowledgeRequest
}

/**
 * Asks what an agent of one module would retrieve for a question, as a customer or as the business (the back end
 * `askKnowledge` query). Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const queryAskKnowledge = async ({
    query = QueryAskKnowledge.Query1,
    request,
    signal,
}: QueryAskKnowledgeParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
