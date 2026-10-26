import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetModuleLiveMutation, SetModuleLiveMutationVariables } from "../__generated__/graphql"

/** The input of the `setModuleLive` mutation. */
export type MutateSetModuleLiveRequest = WireInput<SetModuleLiveMutationVariables["input"]>

type MutateSetModuleLiveResponse = SetModuleLiveMutation

const mutation1: TypedDocumentNode<MutateSetModuleLiveResponse, InputVariables<MutateSetModuleLiveRequest>> = gql`
    mutation SetModuleLive($input: SetModuleLiveInput!) {
        setModuleLive(input: $input) {
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

enum MutationSetModuleLive {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetModuleLive,
    TypedDocumentNode<MutateSetModuleLiveResponse, InputVariables<MutateSetModuleLiveRequest>>
> = {
    [MutationSetModuleLive.Mutation1]: mutation1,
}

/** The back end `setModuleLive` mutation. */
export const mutateSetModuleLive = async ({
    mutation = MutationSetModuleLive.Mutation1,
    request,
    signal,
}: MutateParams<MutationSetModuleLive, MutateSetModuleLiveRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
