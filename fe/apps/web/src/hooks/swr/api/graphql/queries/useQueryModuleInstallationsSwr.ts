"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryModuleInstallations } from "@/modules/api/graphql/queries/query-module-installations"

/** The SWR key of the installations list. */
export const QUERY_MODULE_INSTALLATIONS_SWR_KEY = "QUERY_MODULE_INSTALLATIONS_SWR"

/** The installed agents (instances) of the active workspace (the back end `moduleInstallations` query). */
export const useQueryModuleInstallationsSwr = () => {
    const key = useWorkspaceKey(QUERY_MODULE_INSTALLATIONS_SWR_KEY, [])
    return useSWR(key, async ({ signal }: { signal?: AbortSignal } = {}) => {
        const result = await queryModuleInstallations({ signal })
        if (!result.data) throw new Error("moduleInstallations answered no data")
        return result.data.moduleInstallations
    })
}
