import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type {
    UpdateWorkspaceSettingsMutation,
    UpdateWorkspaceSettingsMutationVariables,
} from "../__generated__/graphql"

/** The input of the `updateWorkspaceSettings` mutation: an absent key keeps the value, a null `logoPath` removes the logo. */
export type MutateUpdateWorkspaceSettingsRequest = WireInput<UpdateWorkspaceSettingsMutationVariables["input"]>

type MutateUpdateWorkspaceSettingsResponse = UpdateWorkspaceSettingsMutation

type Document = TypedDocumentNode<
    MutateUpdateWorkspaceSettingsResponse,
    InputVariables<MutateUpdateWorkspaceSettingsRequest>
>

const mutation1: Document = gql`
    mutation UpdateWorkspaceSettings($input: UpdateWorkspaceSettingsInput!) {
        updateWorkspaceSettings(input: $input) {
            logoUrl
            name
            timeZone
        }
    }
`

enum MutationUpdateWorkspaceSettings {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationUpdateWorkspaceSettings, Document> = {
    [MutationUpdateWorkspaceSettings.Mutation1]: mutation1,
}

/** The back end `updateWorkspaceSettings` mutation: saves the name, the time zone or the logo of the open workspace (owner and manager). */
export const mutateUpdateWorkspaceSettings = async ({
    mutation = MutationUpdateWorkspaceSettings.Mutation1,
    request,
    signal,
}: MutateParams<MutationUpdateWorkspaceSettings, MutateUpdateWorkspaceSettingsRequest>): Promise<
    ApolloClient.MutateResult<MutateUpdateWorkspaceSettingsResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
