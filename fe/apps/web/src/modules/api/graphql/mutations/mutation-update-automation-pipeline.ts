import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationUpdateAutomationPipelineArgs } from "../__generated__/schema"

/** The input of the `updateAutomationPipeline` mutation. */
export type MutateUpdateAutomationPipelineRequest = MutationUpdateAutomationPipelineArgs["input"]

/** The response of the `updateAutomationPipeline` mutation. */
type MutateUpdateAutomationPipelineResponse = Pick<Mutation, "updateAutomationPipeline">

const mutation1: TypedDocumentNode<
    MutateUpdateAutomationPipelineResponse,
    InputVariables<MutateUpdateAutomationPipelineRequest>
> = gql`
    mutation UpdateAutomationPipeline($input: UpdateAutomationPipelineInput!) {
        updateAutomationPipeline(input: $input) {
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
    }
`

enum MutationUpdateAutomationPipeline {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationUpdateAutomationPipeline,
    TypedDocumentNode<MutateUpdateAutomationPipelineResponse, InputVariables<MutateUpdateAutomationPipelineRequest>>
> = {
    [MutationUpdateAutomationPipeline.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateUpdateAutomationPipeline}. */
type MutateUpdateAutomationPipelineParams = MutateParams<
    MutationUpdateAutomationPipeline,
    MutateUpdateAutomationPipelineRequest
>

/**
 * Changes one pipeline of the active workspace: switch, settings, wording, hide, the answer to "send by itself" or the Google
 * account it writes with (the back end `updateAutomationPipeline` mutation). Answers the card as it stands afterwards.
 */
export const mutateUpdateAutomationPipeline = async ({
    mutation = MutationUpdateAutomationPipeline.Mutation1,
    request,
    signal,
}: MutateUpdateAutomationPipelineParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
