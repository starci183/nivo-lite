import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMutateRequestVideoRenderSwr } from "@/hooks/swr/api/graphql/mutations/useMutateRequestVideoRenderSwr"
import { useQueryVideoRenderStatusSwr } from "@/hooks/swr/api/graphql/queries/useQueryVideoRenderStatusSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useGraphQLWithToast } from "@/modules/toast"
import { useVideoRefresh } from "./useVideoRefresh"
import { useVideoJobReport } from "./useVideoJobReport"

const RENDER_DONE_STATES: ReadonlyArray<string> = ["done", "succeeded", "failed"]

/** The render being followed and the workspace it was queued in. */
interface VideoRenderJobRef {
    readonly workspaceId: string | undefined
    readonly id: string
}

/** Queues a render, follows its status, and reports its terminal outcome once. */
export const useVideoRender = (initialRenderId?: string) => {
    const t = useTranslations("video")
    const runGraphQL = useGraphQLWithToast()
    const { refresh } = useVideoRefresh()
    const { trigger, isMutating } = useMutateRequestVideoRenderSwr()
    const { activeWorkspaceId } = useActiveWorkspace()
    const { reportStatus, reportError } = useVideoJobReport({
        doneStates: RENDER_DONE_STATES,
        successKey: "status_ready",
        failureFallback: "render-unavailable",
    })
    const [job, setJob] = useState<VideoRenderJobRef>()
    const renderId = job?.workspaceId === activeWorkspaceId ? job?.id : initialRenderId
    const { data: status, error } = useQueryVideoRenderStatusSwr(renderId, {
        onSuccess: (answer) => void reportStatus(answer),
        onError: (failure) => void reportError(failure, renderId),
    })
    const request = async (projectId: string) => {
        const queued = await runGraphQL(() => trigger({ projectId }), { successMessage: t("stage_queued") })
        if (queued !== undefined) {
            setJob({ workspaceId: activeWorkspaceId, id: queued.id })
            await refresh()
        }
        return queued
    }
    return { request, status, error, isMutating }
}
