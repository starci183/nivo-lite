"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateUpdateWorkspaceTheme,
    type MutateUpdateWorkspaceThemeRequest,
} from "@/modules/api/graphql/mutations/mutation-update-workspace-theme"
import { answeredData } from "@/hooks/workspaceread"
import type { UpdateWorkspaceThemeMutation } from "@/modules/api"

/** The SWR key of the updateWorkspaceTheme mutation. */
export const MUTATE_UPDATE_WORKSPACE_THEME_SWR_KEY = "MUTATE_UPDATE_WORKSPACE_THEME_SWR"

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateUpdateWorkspaceThemeRequest
}

/** SWR mutation for {@link mutateUpdateWorkspaceTheme}: `trigger(input)` answers the saved theme and rejects with the back end failure. */
export const useMutateUpdateWorkspaceThemeSwr = (): SWRMutationResponse<
    UpdateWorkspaceThemeMutation["updateWorkspaceTheme"],
    Error,
    typeof MUTATE_UPDATE_WORKSPACE_THEME_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_UPDATE_WORKSPACE_THEME_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateUpdateWorkspaceTheme({ request: arg }),
                MUTATE_UPDATE_WORKSPACE_THEME_SWR_KEY,
            ).updateWorkspaceTheme,
    )
