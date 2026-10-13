import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveReplyTimeoutMutation, SaveReplyTimeoutMutationVariables } from "../__generated__/graphql"

/** The input of the `saveReplyTimeout` mutation. */
export type MutateSaveReplyTimeoutRequest = WireInput<SaveReplyTimeoutMutationVariables["input"]>

type MutateSaveReplyTimeoutResponse = SaveReplyTimeoutMutation

const mutation1: TypedDocumentNode<MutateSaveReplyTimeoutResponse, InputVariables<MutateSaveReplyTimeoutRequest>> = gql`
    mutation SaveReplyTimeout($input: SaveReplyTimeoutInput!) {
        saveReplyTimeout(input: $input) {
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

enum MutationSaveReplyTimeout {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveReplyTimeout,
    TypedDocumentNode<MutateSaveReplyTimeoutResponse, InputVariables<MutateSaveReplyTimeoutRequest>>
> = {
    [MutationSaveReplyTimeout.Mutation1]: mutation1,
}

/** The back end `saveReplyTimeout` mutation. */
export const mutateSaveReplyTimeout = async ({
    mutation = MutationSaveReplyTimeout.Mutation1,
    request,
    signal,
}: MutateParams<MutationSaveReplyTimeout, MutateSaveReplyTimeoutRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
