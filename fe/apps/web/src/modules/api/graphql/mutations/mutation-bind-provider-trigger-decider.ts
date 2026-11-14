import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { BindProviderTriggerDeciderMutation, BindProviderTriggerDeciderMutationVariables } from "../__generated__/graphql"

/** The input of the `bindProviderTriggerDecider` mutation. */
export type MutateBindProviderTriggerDeciderRequest = WireInput<BindProviderTriggerDeciderMutationVariables["input"]>

/** The response of the `bindProviderTriggerDecider` mutation. */
type MutateBindProviderTriggerDeciderResponse = BindProviderTriggerDeciderMutation

type Document = TypedDocumentNode<MutateBindProviderTriggerDeciderResponse, InputVariables<MutateBindProviderTriggerDeciderRequest>>

const mutation1: Document = gql`
    mutation BindProviderTriggerDecider($input: BindProviderTriggerDeciderInput!) {
        bindProviderTriggerDecider(input: $input) {
            connectionId
            name
            kind
            summary {
                vi
                en
            }
            enabled
            enabledAt
            lastFiredAt
            firedCount
            decided
            deciderAgentId
            deciderAgentName
            coreDecides
            canCatchUp
            deciderChoices {
                agentId
                name
            }
        }
    }
`

enum MutateBindProviderTriggerDeciderDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutateBindProviderTriggerDeciderDocument, Document> = {
    [MutateBindProviderTriggerDeciderDocument.Mutation1]: mutation1,
}

type MutateBindProviderTriggerDeciderParams = MutateParams<MutateBindProviderTriggerDeciderDocument, MutateBindProviderTriggerDeciderRequest>

/** Binds the agent that decides one trigger's events, or unbinds it with a null agent. Answers the trigger's row after the change (owner or manager). Rejects with the back end failure. */
export const mutateBindProviderTriggerDecider = async ({
    mutation = MutateBindProviderTriggerDeciderDocument.Mutation1,
    request,
    signal,
}: MutateBindProviderTriggerDeciderParams): Promise<ApolloClient.MutateResult<MutateBindProviderTriggerDeciderResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
