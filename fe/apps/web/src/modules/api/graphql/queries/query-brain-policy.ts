import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { BrainPolicyQuery, BrainPolicyQueryVariables } from "../__generated__/graphql"

/** Generated input of the brainPolicy query. */
type QueryBrainPolicyRequest = WireInput<BrainPolicyQueryVariables["input"]>

/** Generated response of the brainPolicy query. */
type QueryBrainPolicyResponse = BrainPolicyQuery

type Document = TypedDocumentNode<QueryBrainPolicyResponse, InputVariables<QueryBrainPolicyRequest>>

const query1: Document = gql`
    query BrainPolicy($input: BrainPolicyInput!) {
        brainPolicy(input: $input) {
            canEdit
            row {
                factId
                title
                reason
                subjectKey
                attribute
                subjectLabel
                attributeLabel
                type
                current {
                    ...BrainPolicyDetailValueFields
                }
                scheduled {
                    ...BrainPolicyDetailValueFields
                }
                pendingCount
                pendingValues
            }
            proposals {
                factId
                value
                unit
                version
                status
                validFrom
                validTo
                kind
                proposedBy
                proposedAt
                flags
                useAction
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
            history {
                ...BrainPolicyDetailValueFields
            }
        }
    }

    fragment BrainPolicyDetailValueFields on BrainPolicyValueType {
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

enum QueryBrainPolicyDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryBrainPolicyDocument, Document> = {
    [QueryBrainPolicyDocument.Query1]: query1,
}

type QueryBrainPolicyParams = QueryParams<QueryBrainPolicyDocument, QueryBrainPolicyRequest> & {
    request: QueryBrainPolicyRequest
}

/** One shop rule with its waiting proposals (newest first) and its history (newest version first); null when the fact is no rule. Rejects with the back end failure. */
export const queryBrainPolicy = async ({
    query = QueryBrainPolicyDocument.Query1,
    request,
    signal,
}: QueryBrainPolicyParams): Promise<ApolloClient.QueryResult<QueryBrainPolicyResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
