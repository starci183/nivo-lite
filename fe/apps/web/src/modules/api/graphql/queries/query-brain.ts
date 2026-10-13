import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { BrainQuery } from "../__generated__/graphql"

/** The response of the `brain` query: the typed payload straight from the back end contract. */
type QueryBrainResponse = BrainQuery

const query1: TypedDocumentNode<QueryBrainResponse> = gql`
    query Brain {
        brain {
            extractions {
                sourceId
                status
            }
            facts {
                attribute
                attributeLabel
                decidedAt
                decidedBy
                evidence {
                    at
                    kind
                    label
                    quote
                    ref
                }
                id
                installationId
                modules
                proposalKind
                proposedAt
                proposedBy
                scope
                sourceKind
                status
                subjectKey
                subjectLabel
                subjectType
                trust
                unit
                validFrom
                validTo
                value
            }
            gaps {
                attributeGuess
                count
                id
                lastSeenAt
                module
                question
                reopenedCount
                topic
            }
            gapsOpen
            lenses {
                audience
                module
                name
            }
            lessons {
                appliesWhen
                body
                evidence {
                    at
                    kind
                    label
                    quote
                    ref
                }
                id
                module
                status
                title
            }
        }
    }
`

enum QueryBrain {
    Query1 = "query1",
}

const queryMap: Record<QueryBrain, TypedDocumentNode<QueryBrainResponse>> = {
    [QueryBrain.Query1]: query1,
}

/** Apollo params for {@link queryBrain}. */
type QueryBrainParams = QueryParams<QueryBrain>

/**
 * Reads the shared Second Brain of the workspace: the facts, lessons, unanswered questions, lenses and document readings
 * (the back end `brain` query). Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const queryBrain = async ({ query = QueryBrain.Query1, signal }: QueryBrainParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
