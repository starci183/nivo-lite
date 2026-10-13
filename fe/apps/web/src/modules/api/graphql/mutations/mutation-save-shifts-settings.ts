import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveShiftsSettingsMutation, SaveShiftsSettingsMutationVariables } from "../__generated__/graphql"

/** The input of the `saveShiftsSettings` mutation. */
export type MutateSaveShiftsSettingsRequest = WireInput<SaveShiftsSettingsMutationVariables["input"]>

/** The response of the `saveShiftsSettings` mutation. */
type MutateSaveShiftsSettingsResponse = SaveShiftsSettingsMutation

const mutation1: TypedDocumentNode<
    MutateSaveShiftsSettingsResponse,
    InputVariables<MutateSaveShiftsSettingsRequest>
> = gql`
    mutation SaveShiftsSettings($input: SaveShiftsSettingsInput!) {
        saveShiftsSettings(input: $input)
    }
`

enum MutationSaveShiftsSettings {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveShiftsSettings,
    TypedDocumentNode<MutateSaveShiftsSettingsResponse, InputVariables<MutateSaveShiftsSettingsRequest>>
> = {
    [MutationSaveShiftsSettings.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveShiftsSettings}. */
type MutateSaveShiftsSettingsParams = MutateParams<MutationSaveShiftsSettings, MutateSaveShiftsSettingsRequest>

/** Runs the `saveShiftsSettings` mutation. */
export const mutateSaveShiftsSettings = async ({
    mutation = MutationSaveShiftsSettings.Mutation1,
    request,
    signal,
}: MutateSaveShiftsSettingsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
