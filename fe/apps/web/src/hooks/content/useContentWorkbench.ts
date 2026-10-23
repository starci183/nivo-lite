"use client"

import { useMemo } from "react"
import { useQueryContentConfigurationSwr, useQueryContentMediaSwr, useQueryContentWorkbenchSwr } from "@/hooks/swr"
import { contentWorkbenchView } from "@/modules/content"
import { readError } from "@/hooks/workspaceread"

/** Loads the content workbench in the browser, including the media needed by the editor. */
export const useContentWorkbench = () => {
    const workbench = useQueryContentWorkbenchSwr()
    const configuration = useQueryContentConfigurationSwr()
    const request = useMemo(() => {
        const attachments = workbench.data?.items.flatMap((item) => item.media) ?? []
        return workbench.data
            ? {
                  limit: 30,
                  paths: [...new Set(attachments.flatMap((item) => (item.path ? [item.path] : [])))],
                  videoIds: [
                      ...new Set(
                          attachments.flatMap((item) => (item.kind === "video_render" && item.id ? [item.id] : [])),
                      ),
                  ],
              }
            : undefined
    }, [workbench.data])
    const media = useQueryContentMediaSwr(request)
    const data = useMemo(
        () =>
            workbench.data && configuration.data
                ? contentWorkbenchView(workbench.data, configuration.data, media.data)
                : undefined,
        [workbench.data, configuration.data, media.data],
    )
    return {
        data,
        error: readError(workbench) ?? readError(configuration),
        isLoading: workbench.isLoading || configuration.isLoading,
    }
}
