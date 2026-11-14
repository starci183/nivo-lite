import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { BrainCritiqueQuery, BrainCritiqueQueryVariables } from "../__generated__/graphql"

/** Generated input of the brainCritique query: the document, and which point states to bring (default open). */
export type QueryBrainCritiqueRequest = WireInput<BrainCritiqueQueryVariables["input"]>

/** Generated response of the brainCritique query. */
type QueryBrainCritiqueResponse = BrainCritiqueQuery

type Document = TypedDocumentNode<QueryBrainCritiqueResponse, InputVariables<QueryBrainCritiqueRequest>>

const query1: Document = gql`
    query BrainCritique($input: BrainCritiqueInput!) {
        brainCritique(input: $input) {
            sourceId
            title
            counts {
                answered
                gone
                high
                open
                skipped
            }
            review {
                attempts
                finishedAt
                reason
                released
                releasedAt
                state
                waitingPassages
            }
            serving {
                heldPassages
                reasons
                state
                totalPassages
                unreviewedPassages
                withheldPassages
            }
            points {
                id
                group
                kind
                severity
                state
                origin
                line
                why
                question
                firstSeenAt
                decidedAt
                proposalFactId
                against {
                    kind
                    factId
                    value
                    sourceTitle
                }
                quotes {
                    text
                    placeKind
                    placeLabel
                    chunkHash
                    passageId
                    sourceTitle
                    role
                }
                choices {
                    id
                    label
                    needsInput
                    inputHint
                    answer {
                        kind
                        factId
                        value
                        situation
                    }
                }
                answer {
                    kind
                    factId
                    value
                    situation
                }
            }
        }
    }
`

enum QueryBrainCritiqueDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryBrainCritiqueDocument, Document> = {
    [QueryBrainCritiqueDocument.Query1]: query1,
}

type QueryBrainCritiqueParams = QueryParams<QueryBrainCritiqueDocument, QueryBrainCritiqueRequest> & {
    request: QueryBrainCritiqueRequest
}

/** The document critic's view of one document: its points (high first), counts, review state and what customers may read. Rejects with the back end failure. */
export const queryBrainCritique = async ({
    query = QueryBrainCritiqueDocument.Query1,
    request,
    signal,
}: QueryBrainCritiqueParams): Promise<ApolloClient.QueryResult<QueryBrainCritiqueResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
