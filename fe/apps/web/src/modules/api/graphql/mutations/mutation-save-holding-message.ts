import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveHoldingMessageMutation, SaveHoldingMessageMutationVariables } from "../__generated__/graphql"

/** The input of the `saveHoldingMessage` mutation. */
export type MutateSaveHoldingMessageRequest = WireInput<SaveHoldingMessageMutationVariables["input"]>

type MutateSaveHoldingMessageResponse = SaveHoldingMessageMutation

const mutation1: TypedDocumentNode<
    MutateSaveHoldingMessageResponse,
    InputVariables<MutateSaveHoldingMessageRequest>
> = gql`
    mutation SaveHoldingMessage($input: SaveHoldingMessageInput!) {
        saveHoldingMessage(input: $input) {
            activeContextVersionId
            activeVersion
            agentHandle
            agentId
            agentName
            createdAt
            id
            isMulti
            liveEnabled
            moduleKey
            name
            operatingMode
            settings
            status
            workspaceId
        }
    }
`

enum MutationSaveHoldingMessage {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveHoldingMessage,
    TypedDocumentNode<MutateSaveHoldingMessageResponse, InputVariables<MutateSaveHoldingMessageRequest>>
> = {
    [MutationSaveHoldingMessage.Mutation1]: mutation1,
}

/** The back end `saveHoldingMessage` mutation. */
export const mutateSaveHoldingMessage = async ({
    mutation = MutationSaveHoldingMessage.Mutation1,
    request,
    signal,
}: MutateParams<MutationSaveHoldingMessage, MutateSaveHoldingMessageRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
