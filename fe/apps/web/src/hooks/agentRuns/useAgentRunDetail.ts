"use client"

import { useLocale, useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import { slotOfSwr } from "@/hooks/slot"
import {
    useMutateCancelAgentRunSwr,
    useMutateResumeAgentRunSwr,
    useQueryAgentRunSwr,
    useQueryAgentRunWorkflowsSwr,
    useQueryAgentRunsSwr,
} from "@/hooks/swr"
import { runDetailViewOf, runGraphOf } from "@/modules/agentRuns"
import { stepsLocaleOf } from "@/modules/workflowSteps"
import { useGraphQLWithToast } from "@/modules/toast"
import type { DataSlot, RunDetailView } from "@/modules/types"
import { useLeadFreeze } from "@/hooks/leadFreeze"
import { useRunContext } from "./useRunContext"
import { useRunDecision } from "./useRunDecision"
import { useRunEntityContext } from "./useRunEntityContext"
import { useRunGraphSource } from "./useRunGraphSource"

/** A run that is being driven is read again every 3 seconds, so its steps and its map move while the page is open. */
const BUSY_MS = 3_000

/** The page of one run: the read, the step the person selected and the command that runs a stopped run again. */
export interface AgentRunDetailData {
    readonly slot: DataSlot<RunDetailView>
    readonly select: (nodeKey: string) => void
    readonly resume: () => void
    readonly isResuming: boolean
    /** Stops the run (queued, running or waiting); what it already sent is not undone. */
    readonly cancel: () => void
    readonly isCancelling: boolean
    /** Answers the decision the run waits on. */
    readonly decide: (verdict: "approve" | "retry" | "reject") => void
    readonly isDeciding: boolean
    /** The agent has no such run. */
    readonly isMissing: boolean
    readonly reload: () => void
}

/** The run of one agent instance with its steps, the map of the graph it ran on painted by them, and the step selected. */
export const useAgentRunDetail = (module: string, installationId: string, runId: string): AgentRunDetailData => {
    const t = useTranslations("agentRuns")
    const locale = stepsLocaleOf(useLocale())
    const baseContext = useRunContext(module, installationId)
    const runGraphQL = useGraphQLWithToast()
    const resumeRun = useMutateResumeAgentRunSwr()
    const cancelRun = useMutateCancelAgentRunSwr()
    const decision = useRunDecision(installationId, runId)
    const freeze = useLeadFreeze({ leadId: "", runId })
    const [selection, setSelection] = useState("")
    const read = useQueryAgentRunSwr(
        { installationId, runId },
        {
            refreshInterval: (latest: { readonly row: { readonly status: string } } | null | undefined) =>
                latest?.row.status === "running" || latest?.row.status === "waiting" ? BUSY_MS : 0,
        },
    )
    const runs = useQueryAgentRunsSwr({ installationId })
    const leadId = read.data?.steps.flatMap((step) => step.input).find((fact) => fact.key === "leadId")?.value ?? null
    const entityContext = useRunEntityContext(baseContext, leadId)
    const context = useMemo(() => ({ ...entityContext, isFrozen: freeze.freeze !== null }), [entityContext, freeze.freeze])
    const pins = useQueryAgentRunWorkflowsSwr({ installationId, runIds: [runId] })
    const pin = pins.data?.[0]
    const source = useRunGraphSource(installationId, pin, pins.data !== undefined)
    const nodes = useMemo(() => runGraphOf(source, locale, (key) => (t.has(`nodeName_${key}`) ? t(`nodeName_${key}`) : undefined)), [source, locale, t])
    const view = useMemo(
        () =>
            read.data === undefined || read.data === null
                ? undefined
                : runDetailViewOf(
                      pin === undefined
                          ? read.data
                          : {
                                ...read.data,
                                row: { ...read.data.row, versionNumber: pin.version, workflowName: pin.workflowName },
                            },
                      nodes,
                      selection,
                      runs.data,
                      context,
                      locale,
                  ),
        [read.data, pin, nodes, selection, runs.data, context, locale],
    )
    const { mutate } = read
    const resume = useCallback(() => {
        void runGraphQL(() => resumeRun.trigger({ runId, reason: t("resumeReason") }), {
            successMessage: t("resumed"),
        }).then(() => mutate())
    }, [runGraphQL, resumeRun, runId, t, mutate])
    const cancel = useCallback(() => {
        void runGraphQL(
            async () => {
                const answer = await cancelRun.trigger({ runId })
                if (answer.kind === "not_cancellable") throw new Error(t("cancelNotCancellable"))
            },
            { successMessage: t("cancelled") },
        ).then(() => mutate())
    }, [runGraphQL, cancelRun, runId, t, mutate])
    return {
        slot: slotOfSwr<RunDetailView>({ data: view, error: read.error, isLoading: read.isLoading }),
        select: setSelection,
        resume,
        isResuming: resumeRun.isMutating,
        cancel,
        isCancelling: cancelRun.isMutating,
        ...decision,
        isMissing: read.data === null,
        reload: () => void mutate(),
    }
}
