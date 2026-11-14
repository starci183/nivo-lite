"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateUpdateWorkspaceSettings,
    type MutateUpdateWorkspaceSettingsRequest,
} from "@/modules/api/graphql/mutations/mutation-update-workspace-settings"
import { answeredData } from "@/hooks/workspaceread"
import type { UpdateWorkspaceSettingsMutation } from "@/modules/api"

/** The SWR key of the updateWorkspaceSettings mutation. */
export const MUTATE_UPDATE_WORKSPACE_SETTINGS_SWR_KEY = "MUTATE_UPDATE_WORKSPACE_SETTINGS_SWR"

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateUpdateWorkspaceSettingsRequest
}

/** SWR mutation for {@link mutateUpdateWorkspaceSettings}: `trigger(input)` answers the saved settings and rejects with the back end failure. */
export const useMutateUpdateWorkspaceSettingsSwr = (): SWRMutationResponse<
    UpdateWorkspaceSettingsMutation["updateWorkspaceSettings"],
    Error,
    typeof MUTATE_UPDATE_WORKSPACE_SETTINGS_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_UPDATE_WORKSPACE_SETTINGS_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateUpdateWorkspaceSettings({ request: arg }),
                MUTATE_UPDATE_WORKSPACE_SETTINGS_SWR_KEY,
            ).updateWorkspaceSettings,
    )
