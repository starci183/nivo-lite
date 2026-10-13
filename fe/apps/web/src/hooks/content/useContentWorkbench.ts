import { useMemo } from "react"
import { useQueryContentConfigurationSwr } from "@/hooks/swr/api/graphql/queries/useQueryContentConfigurationSwr"
import { useQueryContentMediaSwr } from "@/hooks/swr/api/graphql/queries/useQueryContentMediaSwr"
import { useQueryContentWorkbenchSwr } from "@/hooks/swr/api/graphql/queries/useQueryContentWorkbenchSwr"
import { contentWorkbenchView } from "@/modules/content"

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
        error: workbench.error ?? configuration.error,
        isLoading: workbench.isLoading || configuration.isLoading,
    }
}
