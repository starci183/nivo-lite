"use client"

import useSWR, { type SWRResponse } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { answeredData } from "@/hooks/workspaceread"
import { queryWorkspaceSettings } from "@/modules/api/graphql/queries/query-workspace-settings"
import type { WorkspaceSettingsQuery } from "@/modules/api"

/** The SWR key of the workspaceSettings query; the settings page, the top bar logo and the commands that change it share it. */
export const QUERY_WORKSPACE_SETTINGS_SWR_KEY = "QUERY_WORKSPACE_SETTINGS_SWR"

/** The open workspace's name, time zone and logo (any member reads). */
export const useQueryWorkspaceSettingsSwr = (): SWRResponse<WorkspaceSettingsQuery["workspaceSettings"], Error> =>
    useSWR(
        useWorkspaceKey(QUERY_WORKSPACE_SETTINGS_SWR_KEY, []),
        async () => answeredData(await queryWorkspaceSettings(), "workspaceSettings").workspaceSettings,
    )
