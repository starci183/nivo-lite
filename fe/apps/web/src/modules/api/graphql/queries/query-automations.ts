import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `automations` query: the typed payload straight from the back end contract. */
type QueryAutomationsResponse = Pick<Query, "automations">

/** The fields of one template card, spread into the gallery query. */
const automationCardFields = gql`
    fragment AutomationCardFields on AutomationCardType {
        key
        pipelineId
        enabled
        dismissed
        config
        body
        bodyVersion
        basedOnContext
        currentContext
        bodyStale
        gate
        missing {
            kind
            key
            label {
                vi
                en
            }
        }
        proposed
        comingSoon
        lastRunAt
        runCount
        trust {
            streak
            offered
            autoSend
        }
        google
        sheetUrl
        def {
            key
            version
            position
            pack
            executor
            n8n {
                webhook
                audience
                data
            }
            moduleKey
            icon
            name {
                vi
                en
            }
            description {
                vi
                en
            }
            trigger {
                kind
                event
                line {
                    vi
                    en
                }
            }
            requires {
                modules
                channels
                connections
                capabilities
            }
            settings {
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
                suffix {
                    vi
                    en
                }
                maxLength
                required
            }
            contentMode
            guardrails {
                vi
                en
            }
            variables
            defaultBody {
                vi
                en
            }
            authority {
                action
                alwaysAsk
            }
            defaults
        }
    }
`

const query1: TypedDocumentNode<QueryAutomationsResponse> = gql`
    query Automations {
        automations {
            cards {
                ...AutomationCardFields
            }
            runs {
                id
                pipelineId
                templateKey
                status
                triggerRef
                summary
                steps {
                    label
                    status
                    detail
                }
                evidence
                error
                createdAt
                finishedAt
                workItemId
                message
            }
            shop {
                shop
                hours
                tone
            }
            sample {
                variables
                neutral
            }
        }
    }
    ${automationCardFields}
`

enum QueryAutomations {
    Query1 = "query1",
}

const queryMap: Record<QueryAutomations, TypedDocumentNode<QueryAutomationsResponse>> = {
    [QueryAutomations.Query1]: query1,
}

/** Apollo params for {@link queryAutomations}. */
type QueryAutomationsParams = QueryParams<QueryAutomations>

/**
 * Reads the automations gallery of the active workspace: one card per template, the latest runs, the shop the previews speak
 * for and the sample values of the previews (the back end `automations` query). Rejects with the back end failure
 * (`CombinedGraphQLErrors`, message localized by the server) instead of answering partial data.
 */
export const queryAutomations = async ({ query = QueryAutomations.Query1, signal }: QueryAutomationsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
