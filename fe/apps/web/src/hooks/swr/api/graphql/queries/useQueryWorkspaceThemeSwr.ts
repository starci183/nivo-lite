"use client"

import useSWR, { type SWRResponse } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { answeredData } from "@/hooks/workspaceread"
import { queryWorkspaceTheme } from "@/modules/api/graphql/queries/query-workspace-theme"
import type { WorkspaceThemeQuery } from "@/modules/api"

/** The SWR key of the workspaceTheme query; the console theme and the settings tab share it. */
export const QUERY_WORKSPACE_THEME_SWR_KEY = "QUERY_WORKSPACE_THEME_SWR"

/** The open workspace's brand theme (any member reads); null while it wears the NIVO default. */
export const useQueryWorkspaceThemeSwr = (): SWRResponse<WorkspaceThemeQuery["workspaceTheme"], Error> =>
    useSWR(
        useWorkspaceKey(QUERY_WORKSPACE_THEME_SWR_KEY, []),
        async () => answeredData(await queryWorkspaceTheme(), "workspaceTheme").workspaceTheme,
    )
