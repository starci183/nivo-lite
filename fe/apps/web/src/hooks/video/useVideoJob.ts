import { useTranslations } from "next-intl"
import { useState } from "react"
import type { SWRResponse } from "swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useGraphQLWithToast } from "@/modules/toast"
import { useVideoJobReport } from "./useVideoJobReport"
import { useVideoRefresh } from "./useVideoRefresh"

/** The answer of one job status read. */
interface VideoJobStatusView {
    readonly id: string
    readonly status: string
    readonly errorCode?: string | null
}

/** The callbacks a job status read reports to. */
interface VideoJobStatusCallbacks<TStatus> {
    readonly onSuccess: (answer: TStatus) => void
    readonly onError: (failure: Error) => void
}

/** What one kind of queued video job needs: how to queue it, how to read its status, and how its outcome is told. */
interface VideoJobOptions<TStatus extends VideoJobStatusView> {
    /** Queues the job of a project; answers the queued job. */
    readonly trigger: (request: { readonly projectId: string }) => Promise<{ readonly id: string }>
    /** The status read of the job (an SWR hook, idle while the id is undefined). */
    readonly useStatus: (
        id: string | undefined,
        callbacks: VideoJobStatusCallbacks<TStatus>,
    ) => Pick<SWRResponse<TStatus, Error>, "data" | "error">
    readonly doneStates: ReadonlyArray<string>
    readonly successKey: string
    readonly failureFallback: string
    /** The catalog key of the toast once the job is queued. */
    readonly queuedKey: string
    /** A job already running when the page opened. */
    readonly initialId?: string
}

/** Queues a video job of the active workspace, follows its status, and reports its terminal outcome once. */
export const useVideoJob = <TStatus extends VideoJobStatusView>(options: VideoJobOptions<TStatus>) => {
    const t = useTranslations("video")
    const runGraphQL = useGraphQLWithToast()
    const { refresh } = useVideoRefresh()
    const { activeWorkspaceId } = useActiveWorkspace()
    const { reportStatus, reportError } = useVideoJobReport(options)
    const [job, setJob] = useState<{ readonly workspaceId: string | undefined; readonly id: string }>()
    const jobId = job?.workspaceId === activeWorkspaceId ? job?.id : options.initialId
    const { data: status, error } = options.useStatus(jobId, {
        onSuccess: (answer) => void reportStatus(answer),
        onError: (failure) => void reportError(failure, jobId),
    })
    const request = async (projectId: string) => {
        const queued = await runGraphQL(() => options.trigger({ projectId }), { successMessage: t(options.queuedKey) })
        if (queued !== undefined) {
            setJob({ workspaceId: activeWorkspaceId, id: queued.id })
            await refresh()
        }
        return queued
    }
    return { request, status, error }
}
