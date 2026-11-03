"use client"

import { useQueryContentAiStatusSwr } from "@/hooks/swr"
import type { ContentAiRequestedType, ContentAiStatusType } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useCallback, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { useContentRefresh } from "./useContentRefresh"

/** What one queued content AI job needs from its caller. */
interface ContentAiJobOptions<TRequest> {
    readonly isActive?: boolean
    readonly scope?: string
    readonly queue: (request: TRequest) => Promise<ContentAiRequestedType | undefined>
    readonly successMessage: (status: ContentAiStatusType) => string
    readonly onSucceeded?: ((status: ContentAiStatusType) => void) | undefined
}

/** The job being followed and the workspace it was queued in. */
interface ContentAiJobRef {
    readonly id: string
    readonly workspaceId: string | undefined
}

const FAILURE_KEYS: Readonly<Record<string, string>> = {
    CONTENT_AI_INVALID_INPUT: "err_input",
    CONTENT_AI_DRAFTING_BLOCKED: "err_drafting_off",
    CONTENT_AI_NO_PILLARS: "err_plan_no_pillars",
    CONTENT_AI_NO_CADENCE: "err_plan_no_cadence",
    CONTENT_AI_NO_SLOTS: "err_plan_no_slots",
    CONTENT_AI_INVALID_ANSWER: "err_ai_unreadable",
    CONTENT_AI_EMPTY_ANSWER: "err_ai_empty",
    CONTENT_AI_NOT_FOUND: "err_item_not_found",
    CONTENT_AI_FAILED: "err_ai_busy",
}

interface ContentQueueExecution<TRequest> {
    readonly options: ContentAiJobOptions<TRequest>
    readonly input: TRequest
    readonly capture: () => () => boolean
    readonly runGraphQL: ReturnType<typeof useGraphQLWithToast>
    readonly queuedMessage: string
    readonly workspaceId: string | undefined
    readonly accept: Dispatch<SetStateAction<ContentAiJobRef | undefined>>
    readonly pending: Dispatch<SetStateAction<ReadonlyArray<() => boolean>>>
}

/** Request acceptance retains its standard toast while only its origin owns request pending and the followed job. */
const requestContentAiJob = async <TRequest>(context: ContentQueueExecution<TRequest>) => {
    const isCurrent = context.capture()
    if (!context.options.isActive || !isCurrent()) return undefined
    context.pending((current) => [...current, isCurrent])
    try {
        const accepted = await context.runGraphQL(() => context.options.queue(context.input), {
            successMessage: context.queuedMessage,
        })
        if (accepted !== undefined && isCurrent()) context.accept({ id: accepted.id, workspaceId: context.workspaceId })
        return accepted
    } catch (error) {
        await context.runGraphQL(() => Promise.reject(error), { showSuccessToast: false })
        return undefined
    } finally {
        if (isCurrent()) context.pending((current) => current.filter((operation) => operation !== isCurrent))
    }
}

/** Queues one content AI job, follows its status, and reports its terminal outcome once. */
export const useContentAiJob = <TRequest>(options: ContentAiJobOptions<TRequest>) => {
    const t = useTranslations("content")
    const runGraphQL = useGraphQLWithToast()
    const { refresh } = useContentRefresh()
    const { activeWorkspaceId } = useActiveWorkspace()
    const isActive = options.isActive ?? true
    const scope = options.scope ?? JSON.stringify([activeWorkspaceId])
    const lifetime = useFeatureLifetime(isActive, scope)
    const [job, setJob] = useState<ContentAiJobRef>()
    const [requests, setRequests] = useState<ReadonlyArray<() => boolean>>([])
    const reported = useRef<string | undefined>(undefined)
    useFeatureReset({
        isActive,
        isReady: true,
        scope,
        onReset: () => {
            setJob(undefined)
            setRequests([])
            reported.current = undefined
        },
    })
    const jobId = isActive && job && job.workspaceId === activeWorkspaceId ? job.id : undefined
    const { successMessage, onSucceeded } = options

    const reportStatus = useCallback(
        async (status: ContentAiStatusType) => {
            if (!isActive) return
            const isCurrent = lifetime.capture()
            if (status.status !== "succeeded" && status.status !== "failed") return
            if (reported.current === status.id) return
            reported.current = status.id
            if (status.status === "failed") {
                const message = t(FAILURE_KEYS[status.errorCode ?? ""] ?? "err_unknown")
                await runGraphQL(() => Promise.reject(new Error(message)), { showSuccessToast: false })
                return
            }
            await runGraphQL(() => Promise.resolve(status), { successMessage: successMessage(status) })
            await runGraphQL(refresh, { showSuccessToast: false })
            if (isCurrent()) onSucceeded?.(status)
        },
        [isActive, lifetime, onSucceeded, refresh, runGraphQL, successMessage, t],
    )
    const reportFailure = useCallback(
        async (error: Error) => {
            if (!isActive) return
            if (reported.current === jobId) return
            reported.current = jobId
            await runGraphQL(() => Promise.reject(error), { showSuccessToast: false })
        },
        [isActive, jobId, runGraphQL],
    )
    const observe = (failure: unknown) => runGraphQL(() => Promise.reject(failure), { showSuccessToast: false })
    const { data: status } = useQueryContentAiStatusSwr(jobId, {
        onSuccess: (next) => {
            reportStatus(next).catch(observe)
        },
        onError: (error) => {
            reportFailure(error).catch(observe)
        },
    })

    const request = useCallback(
        (input: TRequest) =>
            requestContentAiJob({
                options: { ...options, isActive },
                input,
                capture: lifetime.capture,
                runGraphQL,
                queuedMessage: t("aiQueued"),
                workspaceId: activeWorkspaceId,
                accept: setJob,
                pending: setRequests,
            }),
        [activeWorkspaceId, isActive, lifetime, options, runGraphQL, t],
    )

    const isTerminal = status?.status === "succeeded" || status?.status === "failed"
    return { request, status, isPending: requests.length > 0 || (jobId !== undefined && !isTerminal) }
}
