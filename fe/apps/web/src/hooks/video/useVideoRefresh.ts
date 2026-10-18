"use client"

import { useCallback } from "react"
import { mutate } from "swr"
import {
    QUERY_AGENT_DASHBOARD_SWR_KEY,
    QUERY_VIDEO_BRAND_SWR_KEY,
    QUERY_VIDEO_FIGURES_SWR_KEY,
    QUERY_VIDEO_PROJECT_SWR_KEY,
    QUERY_VIDEO_PROJECTS_SWR_KEY,
} from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useGraphQLWithToast } from "@/modules/toast"

const VIDEO_KEYS: ReadonlySet<unknown> = new Set([
    QUERY_VIDEO_PROJECTS_SWR_KEY,
    QUERY_VIDEO_PROJECT_SWR_KEY,
    QUERY_VIDEO_FIGURES_SWR_KEY,
    QUERY_VIDEO_BRAND_SWR_KEY,
    QUERY_AGENT_DASHBOARD_SWR_KEY,
])

/** Reads the active workspace's video data again, and runs an action whose outcome is toasted before it does. */
export const useVideoRefresh = () => {
    const runGraphQL = useGraphQLWithToast()
    const { activeWorkspaceId: workspaceId } = useActiveWorkspace()
    const refresh = useCallback(
        () => mutate((key) => Array.isArray(key) && key[1] === workspaceId && VIDEO_KEYS.has(key[0])),
        [workspaceId],
    )
    const complete = useCallback(
        async <T>(work: () => Promise<T>, successMessage: string) => {
            const result = await runGraphQL(work, { successMessage })
            if (result !== undefined) await refresh()
            return result
        },
        [refresh, runGraphQL],
    )
    return { refresh, complete }
}
