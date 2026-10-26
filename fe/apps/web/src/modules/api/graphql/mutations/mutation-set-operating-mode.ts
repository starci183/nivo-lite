import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetOperatingModeMutation, SetOperatingModeMutationVariables } from "../__generated__/graphql"

/** The input of the `setOperatingMode` mutation. */
export type MutateSetOperatingModeRequest = WireInput<SetOperatingModeMutationVariables["input"]>

type MutateSetOperatingModeResponse = SetOperatingModeMutation

const mutation1: TypedDocumentNode<MutateSetOperatingModeResponse, InputVariables<MutateSetOperatingModeRequest>> = gql`
    mutation SetOperatingMode($input: SetOperatingModeInput!) {
        setOperatingMode(input: $input) {
            activeContextVersionId
            activeVersion
            agentHandle
            agentId
            agentName
            createdAt
            id
            isMulti
            lifecycle
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

enum MutationSetOperatingMode {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetOperatingMode,
    TypedDocumentNode<MutateSetOperatingModeResponse, InputVariables<MutateSetOperatingModeRequest>>
> = {
    [MutationSetOperatingMode.Mutation1]: mutation1,
}

/** The back end `setOperatingMode` mutation. */
export const mutateSetOperatingMode = async ({
    mutation = MutationSetOperatingMode.Mutation1,
    request,
    signal,
}: MutateParams<MutationSetOperatingMode, MutateSetOperatingModeRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
