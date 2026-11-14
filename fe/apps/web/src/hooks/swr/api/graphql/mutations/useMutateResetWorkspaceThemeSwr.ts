"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { mutateResetWorkspaceTheme } from "@/modules/api/graphql/mutations/mutation-reset-workspace-theme"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the resetWorkspaceTheme mutation. */
export const MUTATE_RESET_WORKSPACE_THEME_SWR_KEY = "MUTATE_RESET_WORKSPACE_THEME_SWR"

/** SWR mutation for {@link mutateResetWorkspaceTheme}: `trigger()` returns the workspace to the NIVO default theme and rejects with the back end failure. */
export const useMutateResetWorkspaceThemeSwr = (): SWRMutationResponse<
    boolean,
    Error,
    typeof MUTATE_RESET_WORKSPACE_THEME_SWR_KEY
> =>
    useSWRMutation(
        MUTATE_RESET_WORKSPACE_THEME_SWR_KEY,
        async () =>
            answeredData(await mutateResetWorkspaceTheme(), MUTATE_RESET_WORKSPACE_THEME_SWR_KEY).resetWorkspaceTheme,
    )
