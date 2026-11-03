"use client"
import { useCallback, useState } from "react"
import { mutate } from "@/modules/viewer-cache"
import {
    QUERY_AGENT_DASHBOARD_SWR_KEY,
    QUERY_VIDEO_BRAND_SWR_KEY,
    QUERY_VIDEO_FIGURES_SWR_KEY,
    QUERY_VIDEO_PROJECT_SWR_KEY,
    QUERY_VIDEO_PROJECTS_SWR_KEY,
} from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { useGraphQLWithToast } from "@/modules/toast"
const VIDEO_KEYS: ReadonlySet<unknown> = new Set([
    QUERY_VIDEO_PROJECTS_SWR_KEY,
    QUERY_VIDEO_PROJECT_SWR_KEY,
    QUERY_VIDEO_FIGURES_SWR_KEY,
    QUERY_VIDEO_BRAND_SWR_KEY,
    QUERY_AGENT_DASHBOARD_SWR_KEY,
])
/** Actual conditional video surface and tenant/instance/project identity. */
export interface VideoOwner {
    readonly isActive: boolean
    readonly scope: string
}
type Operation = () => boolean

/** What the owner of the video commands hands out: the refresh, the guarded completion and whether one is pending. */
export type VideoRefresh = ReturnType<typeof useVideoRefresh>

type UseVideoRefreshResult = {
    refresh: () => Promise<unknown>
    complete: <T>(
        work: () => Promise<T>,
        successMessage: string,
        onResult?: (result: T | undefined) => void,
    ) => Promise<T | undefined>
    isPending: boolean
}

/** Existing command owner: standard feedback and exact cache refresh precede current-origin completion and pending settlement. */
export const useVideoRefresh = (owner?: VideoOwner): UseVideoRefreshResult => {
    const runGraphQL = useGraphQLWithToast()
    const { activeWorkspaceId: workspaceId } = useActiveWorkspace()
    const isActive = owner?.isActive ?? true,
        scope = owner?.scope ?? JSON.stringify([workspaceId])
    const lifetime = useFeatureLifetime(isActive, scope)
    const [pending, setPending] = useState<ReadonlyArray<Operation>>([])
    useFeatureReset({ isActive, isReady: true, scope, onReset: () => setPending([]) })
    const refresh = useCallback(
        (): Promise<unknown> => mutate((key) => Array.isArray(key) && key[1] === workspaceId && VIDEO_KEYS.has(key[0])),
        [workspaceId],
    )
    const complete = useCallback(
        async <T>(
            work: () => Promise<T>,
            successMessage: string,
            onResult?: (result: T | undefined) => void,
        ): Promise<T | undefined> => {
            const isCurrent = lifetime.capture()
            if (!isCurrent()) return undefined
            setPending((current) => [...current, isCurrent])
            try {
                const result = await runGraphQL(work, { successMessage })
                if (result !== undefined) await refresh()
                if (isCurrent()) onResult?.(result)
                return result
            } catch (error) {
                await runGraphQL(() => Promise.reject(error), { showSuccessToast: false })
                return undefined
            } finally {
                if (isCurrent()) setPending((current) => current.filter((operation) => operation !== isCurrent))
            }
        },
        [lifetime, refresh, runGraphQL],
    )
    return { refresh, complete, isPending: pending.length > 0 }
}
