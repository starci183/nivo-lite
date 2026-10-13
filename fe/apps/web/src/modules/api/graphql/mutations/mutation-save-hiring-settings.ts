import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSaveHiringSettingsArgs } from "../__generated__/schema"

/** The input of the `saveHiringSettings` mutation. */
export type MutateSaveHiringSettingsRequest = MutationSaveHiringSettingsArgs["input"]

/** The response of the `saveHiringSettings` mutation. */
type MutateSaveHiringSettingsResponse = Pick<Mutation, "saveHiringSettings">

const mutation1: TypedDocumentNode<
    MutateSaveHiringSettingsResponse,
    InputVariables<MutateSaveHiringSettingsRequest>
> = gql`
    mutation SaveHiringSettings($input: SaveHiringSettingsInput!) {
        saveHiringSettings(input: $input) {
            adTone
            applyConsentText
            autoCloseWhenFilled
            notifyNewCandidate
            publicSlug
            remindInterview
            retentionDays
            workspaceId
        }
    }
`

enum MutationSaveHiringSettings {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveHiringSettings,
    TypedDocumentNode<MutateSaveHiringSettingsResponse, InputVariables<MutateSaveHiringSettingsRequest>>
> = {
    [MutationSaveHiringSettings.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveHiringSettings}. */
type MutateSaveHiringSettingsParams = MutateParams<MutationSaveHiringSettings, MutateSaveHiringSettingsRequest>

/** Runs the `saveHiringSettings` mutation. */
export const mutateSaveHiringSettings = async ({
    mutation = MutationSaveHiringSettings.Mutation1,
    request,
    signal,
}: MutateSaveHiringSettingsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
