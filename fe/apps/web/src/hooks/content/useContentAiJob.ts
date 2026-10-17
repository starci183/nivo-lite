"use client"

import { useQueryContentAiStatusSwr } from "@/hooks/swr"
import type { ContentAiRequestedType, ContentAiStatusType } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useCallback, useRef, useState } from "react"
import { useContentRefresh } from "./useContentRefresh"

/** What one queued content AI job needs from its caller. */
interface ContentAiJobOptions<TRequest> {
    readonly queue: (request: TRequest) => Promise<ContentAiRequestedType | undefined>
    readonly isMutating: boolean
    readonly successMessage: (status: ContentAiStatusType) => string
    readonly onSucceeded?: (status: ContentAiStatusType) => void
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

/** Queues one content AI job, follows its status, and reports its terminal outcome once. */
export const useContentAiJob = <TRequest>(options: ContentAiJobOptions<TRequest>) => {
    const t = useTranslations("content")
    const runGraphQL = useGraphQLWithToast()
    const { refresh } = useContentRefresh()
    const { activeWorkspaceId } = useActiveWorkspace()
    const [job, setJob] = useState<ContentAiJobRef>()
    const reported = useRef<string | undefined>(undefined)
    const jobId = job && job.workspaceId === activeWorkspaceId ? job.id : undefined
    const { queue, successMessage, onSucceeded } = options

    const reportStatus = useCallback(
        async (status: ContentAiStatusType) => {
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
            onSucceeded?.(status)
        },
        [onSucceeded, refresh, runGraphQL, successMessage, t],
    )
    const reportFailure = useCallback(
        async (error: Error) => {
            if (reported.current === jobId) return
            reported.current = jobId
            await runGraphQL(() => Promise.reject(error), { showSuccessToast: false })
        },
        [jobId, runGraphQL],
    )
    const { data: status } = useQueryContentAiStatusSwr(jobId, {
        onSuccess: (answer) => void reportStatus(answer),
        onError: (error) => void reportFailure(error),
    })

    const request = useCallback(
        async (input: TRequest) => {
            const accepted = await runGraphQL(() => queue(input), { successMessage: t("aiQueued") })
            if (accepted !== undefined) setJob({ id: accepted.id, workspaceId: activeWorkspaceId })
            return accepted
        },
        [activeWorkspaceId, queue, runGraphQL, t],
    )

    const isTerminal = status?.status === "succeeded" || status?.status === "failed"
    return { request, status, isPending: options.isMutating || (jobId !== undefined && !isTerminal) }
}
