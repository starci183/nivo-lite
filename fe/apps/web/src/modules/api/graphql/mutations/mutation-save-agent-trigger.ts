import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveAgentTriggerMutation, SaveAgentTriggerMutationVariables } from "../__generated__/graphql"

/** The input of the `saveAgentTrigger` mutation. */
export type MutateSaveAgentTriggerRequest = WireInput<SaveAgentTriggerMutationVariables["input"]>

type MutateSaveAgentTriggerResponse = SaveAgentTriggerMutation

const mutation1: TypedDocumentNode<MutateSaveAgentTriggerResponse, InputVariables<MutateSaveAgentTriggerRequest>> = gql`
    mutation SaveAgentTrigger($input: SaveAgentTriggerInput!) {
        saveAgentTrigger(input: $input) {
            atTime
            enabled
            eventName
            id
            kind
            lastFiredAt
            nextRunAt
            preset
            probeKey
            seedKey
            timeZone
        }
    }
`

enum MutationSaveAgentTrigger {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveAgentTrigger,
    TypedDocumentNode<MutateSaveAgentTriggerResponse, InputVariables<MutateSaveAgentTriggerRequest>>
> = {
    [MutationSaveAgentTrigger.Mutation1]: mutation1,
}

/** The back end `saveAgentTrigger` mutation. Adds a trigger to an agent or changes one. */
export const mutateSaveAgentTrigger = async ({
    mutation = MutationSaveAgentTrigger.Mutation1,
    request,
    signal,
}: MutateParams<MutationSaveAgentTrigger, MutateSaveAgentTriggerRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
