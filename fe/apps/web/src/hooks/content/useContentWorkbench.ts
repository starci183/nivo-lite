"use client"

import { useMemo } from "react"
import { useQueryContentConfigurationSwr, useQueryContentMediaSwr, useQueryContentWorkbenchSwr } from "@/hooks/swr"
import { contentWorkbenchView, type ContentWorkbenchData } from "@/modules/content"
import { slotOfReads } from "@/hooks/slot"
import { readError } from "@/hooks/workspaceread"
import type { DataSlot } from "@/modules/types"

/** The view `useContentWorkbench` returns. */
export interface ContentWorkbenchViewShape {
    data: ContentWorkbenchData | undefined
    slot: DataSlot<ContentWorkbenchData>
    error: unknown
    isLoading: boolean
    reload: () => void
}

/** Loads the content workbench in the browser, including the media needed by the editor. */
export const useContentWorkbench = (isActive = true): ContentWorkbenchViewShape => {
    const workbench = useQueryContentWorkbenchSwr(isActive)
    const configuration = useQueryContentConfigurationSwr(isActive)
    const request = useMemo(() => {
        if (workbench.data === undefined) return undefined
        const attachments = workbench.data.items.flatMap((item) => item.media)
        return {
            limit: 30,
            paths: [...new Set(attachments.flatMap((item) => (item.path ? [item.path] : [])))],
            videoIds: [
                ...new Set(attachments.flatMap((item) => (item.kind === "video_render" && item.id ? [item.id] : []))),
            ],
        }
    }, [workbench.data])
    const media = useQueryContentMediaSwr(isActive ? request : undefined)
    const data = useMemo(
        () =>
            workbench.data && configuration.data
                ? contentWorkbenchView(workbench.data, configuration.data, media.data)
                : undefined,
        [workbench.data, configuration.data, media.data],
    )
    return {
        data,
        slot: slotOfReads([workbench, configuration], () => data),
        error: readError(workbench) ?? readError(configuration),
        isLoading: workbench.isLoading || configuration.isLoading,
        reload: () => {
            void Promise.allSettled([workbench.mutate(), configuration.mutate()])
        },
    }
}
