"use client"
import { useTranslations } from "next-intl"
import { useGraphQLWithToast } from "@/modules/toast"
import { useState } from "react"
import type { SlotRead } from "@/modules/types"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { useVideoJobReport } from "./useVideoJobReport"
import { useVideoRefresh } from "./useVideoRefresh"
import type { VideoOwner } from "./useVideoRefresh"
interface VideoJobStatusView {
    readonly id: string
    readonly status: string
    readonly errorCode?: string | null
}
interface VideoJobCallbacks<T> {
    readonly onSuccess: (answer: T) => void
    readonly onError: (failure: Error) => void
}
interface VideoJobRead<T> extends SlotRead<T> {
    readonly mutate: () => Promise<unknown>
}
interface VideoJobOptions<T extends VideoJobStatusView> {
    readonly trigger: (request: { readonly projectId: string }) => Promise<{ readonly id: string }>
    readonly useStatus: (id: string | undefined, callbacks: VideoJobCallbacks<T>) => VideoJobRead<T>
    readonly doneStates: ReadonlyArray<string>
    readonly successKey: string
    readonly failureFallback: string
    readonly queuedKey: string
    readonly initialId?: string
    readonly owner?: VideoOwner
}

/** Queues a real durable job while only its active originating surface follows status and owns local pending. */
export const useVideoJob = <T extends VideoJobStatusView>(options: VideoJobOptions<T>) => {
    const t = useTranslations("video")
    const report = useGraphQLWithToast()
    const { activeWorkspaceId } = useActiveWorkspace()
    const isActive = options.owner?.isActive ?? true,
        scope = options.owner?.scope ?? JSON.stringify([activeWorkspaceId])
    const { complete, isPending } = useVideoRefresh(options.owner)
    const lifetime = useFeatureLifetime(isActive, scope)
    const { reportStatus, reportError } = useVideoJobReport(options)
    const [job, setJob] = useState<{
        readonly workspaceId: string | undefined
        readonly scope: string
        readonly id: string
    }>()
    useFeatureReset({ isActive, isReady: true, scope, onReset: () => setJob(undefined) })
    const ownJobId =
        job !== undefined && job.workspaceId === activeWorkspaceId && job.scope === scope ? job.id : options.initialId
    const jobId = isActive ? ownJobId : undefined
    const read = options.useStatus(jobId, {
        onSuccess: (status) => {
            reportStatus(status).catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
        },
        onError: (failure) => {
            reportError(failure, jobId).catch((error) =>
                report(() => Promise.reject(error), { showSuccessToast: false }),
            )
        },
    })
    const request = (projectId: string) => {
        const isCurrent = lifetime.capture()
        if (!isCurrent()) return Promise.resolve(undefined)
        return complete(
            () => options.trigger({ projectId }),
            t(options.queuedKey),
            (queued) => {
                if (queued !== undefined && isCurrent())
                    setJob({ workspaceId: activeWorkspaceId, scope, id: queued.id })
            },
        )
    }
    return { request, status: read.data, error: read.error, read, isStatusEnabled: jobId !== undefined, isPending }
}
