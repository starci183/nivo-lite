"use client"

import { useTranslations } from "next-intl"
import { useCallback, useRef } from "react"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useGraphQLWithToast } from "@/modules/toast"
import { useVideoRefresh } from "./useVideoRefresh"
import { useVideoFailure } from "./useVideoFailure"

/** The part of a queued job's status the report reads. */
interface VideoJobStatus {
    readonly id: string
    readonly status: string
    readonly errorCode?: string | null
}

/** How one kind of video job is reported. */
interface VideoJobReportOptions {
    /** The statuses that end the job. */
    readonly doneStates: ReadonlyArray<string>
    /** The `video` catalog key of the success copy. */
    readonly successKey: string
    /** The failure code to explain when the job fails without one. */
    readonly failureFallback: string
}

/** Reports the outcome of a queued video job once: a toast for success or failure, then the video data is read again. */
export const useVideoJobReport = ({ doneStates, successKey, failureFallback }: VideoJobReportOptions) => {
    const t = useTranslations("video")
    const failure = useVideoFailure()
    const runGraphQL = useGraphQLWithToast()
    const { refresh } = useVideoRefresh()
    const { activeWorkspaceId } = useActiveWorkspace()
    const reported = useRef<string | undefined>(undefined)
    const reportedError = useRef<string | undefined>(undefined)
    const reportStatus = useCallback(
        async (status: VideoJobStatus) => {
            const identity = `${activeWorkspaceId}:${status.id}`
            if (!doneStates.includes(status.status) || reported.current === identity) return
            reported.current = identity
            await runGraphQL(
                () =>
                    status.status === "failed"
                        ? Promise.reject(new Error(failure(status.errorCode ?? failureFallback)))
                        : Promise.resolve(status),
                { successMessage: t(successKey) },
            )
            await refresh()
        },
        [activeWorkspaceId, doneStates, failure, failureFallback, refresh, runGraphQL, successKey, t],
    )
    const reportError = useCallback(
        async (error: Error, jobId: string | undefined) => {
            if (jobId === undefined) return
            const identity = `${activeWorkspaceId}:${jobId}:${error.message}`
            if (reportedError.current === identity) return
            reportedError.current = identity
            await runGraphQL(() => Promise.reject(error))
        },
        [activeWorkspaceId, runGraphQL],
    )
    return { reportStatus, reportError }
}
