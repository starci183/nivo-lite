import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SetProviderTriggerEnabledMutation, SetProviderTriggerEnabledMutationVariables } from "../__generated__/graphql"

/** The input of the `setProviderTriggerEnabled` mutation. */
export type MutateSetProviderTriggerEnabledRequest = WireInput<SetProviderTriggerEnabledMutationVariables["input"]>

/** The response of the `setProviderTriggerEnabled` mutation. */
type MutateSetProviderTriggerEnabledResponse = SetProviderTriggerEnabledMutation

type Document = TypedDocumentNode<MutateSetProviderTriggerEnabledResponse, InputVariables<MutateSetProviderTriggerEnabledRequest>>

const mutation1: Document = gql`
    mutation SetProviderTriggerEnabled($input: SetProviderTriggerEnabledInput!) {
        setProviderTriggerEnabled(input: $input) {
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

enum MutateSetProviderTriggerEnabledDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutateSetProviderTriggerEnabledDocument, Document> = {
    [MutateSetProviderTriggerEnabledDocument.Mutation1]: mutation1,
}

type MutateSetProviderTriggerEnabledParams = MutateParams<MutateSetProviderTriggerEnabledDocument, MutateSetProviderTriggerEnabledRequest>

/** Turns one trigger of an account on or off; turning on may catch up the events missed while it was off. Answers the trigger's row after the change (owner or manager). Rejects with the back end failure. */
export const mutateSetProviderTriggerEnabled = async ({
    mutation = MutateSetProviderTriggerEnabledDocument.Mutation1,
    request,
    signal,
}: MutateSetProviderTriggerEnabledParams): Promise<ApolloClient.MutateResult<MutateSetProviderTriggerEnabledResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
