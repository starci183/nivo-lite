import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SetAgentAvatarPresetMutation, SetAgentAvatarPresetMutationVariables } from "../__generated__/graphql"

/** The input of the `setAgentAvatarPreset` mutation. */
export type MutateSetAgentAvatarPresetRequest = WireInput<SetAgentAvatarPresetMutationVariables["input"]>

type MutateSetAgentAvatarPresetResponse = SetAgentAvatarPresetMutation

const mutation1: TypedDocumentNode<
    MutateSetAgentAvatarPresetResponse,
    InputVariables<MutateSetAgentAvatarPresetRequest>
> = gql`
    mutation SetAgentAvatarPreset($input: SetAgentAvatarPresetInput!) {
        setAgentAvatarPreset(input: $input) {
            ok
        }
    }
`

enum MutationSetAgentAvatarPreset {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetAgentAvatarPreset,
    TypedDocumentNode<MutateSetAgentAvatarPresetResponse, InputVariables<MutateSetAgentAvatarPresetRequest>>
> = {
    [MutationSetAgentAvatarPreset.Mutation1]: mutation1,
}

/** The back end `setAgentAvatarPreset` mutation: dresses an agent in a preset picture, dropping any uploaded one. */
export const mutateSetAgentAvatarPreset = async ({
    mutation = MutationSetAgentAvatarPreset.Mutation1,
    request,
    signal,
}: MutateParams<MutationSetAgentAvatarPreset, MutateSetAgentAvatarPresetRequest>): Promise<
    ApolloClient.MutateResult<MutateSetAgentAvatarPresetResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
