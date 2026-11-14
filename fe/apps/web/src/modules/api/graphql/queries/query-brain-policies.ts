import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { BrainPoliciesQuery } from "../__generated__/graphql"

/** The response of the `brainPolicies` query: the typed payload straight from the back end contract. */
type QueryBrainPoliciesResponse = BrainPoliciesQuery

type Document = TypedDocumentNode<QueryBrainPoliciesResponse, Record<string, never>>

const query1: Document = gql`
    query BrainPolicies {
        brainPolicies {
            pendingTotal
            canEdit
            derivation {
                state
                pendingFacts
                derivedAt
                error
            }
            groups {
                subjectKey
                subjectLabel
                rows {
                    factId
                    policyId
                    title
                    reason
                    subjectKey
                    attribute
                    subjectLabel
                    attributeLabel
                    type
                    current {
                        ...BrainPolicyValueFields
                    }
                    scheduled {
                        ...BrainPolicyValueFields
                    }
                    pendingCount
                    pendingValues
                }
            }
        }
    }

    fragment BrainPolicyValueFields on BrainPolicyValueType {
        factId
        value
        unit
        version
        status
        validFrom
        validTo
        parameter {
            type
            amountVnd
            per
            percent
            minutes
            from
            to
            yes
            text
        }
        source {
            kind
            label
            at
            count
        }
        audience {
            scope
            modules
            customers
            installationId
        }
    }
`

enum QueryBrainPolicies {
    Query1 = "query1",
}

const queryMap: Record<QueryBrainPolicies, Document> = { [QueryBrainPolicies.Query1]: query1 }

/**
 * Calls the back end brainPolicies query: the shop rules in force in the truth graph, one row per truth the AI derived as a policy, grouped by the derived group, with the state of the derive pass, the
 * value scheduled next, the proposals waiting and whether the viewer may edit (the owner only).
 */
export const queryBrainPolicies = async ({
    query = QueryBrainPolicies.Query1,
    signal,
}: QueryParams<QueryBrainPolicies> = {}): Promise<ApolloClient.QueryResult<QueryBrainPoliciesResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], fetchPolicy: "no-cache" })
}
