"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryAgentWorkflowDiffSwr } from "@/hooks/swr"
import { useWorkflowContext } from "@/hooks/agentWorkflows"
import { diffViewOf } from "@/modules/agentWorkflows"
import type { DataSlot, WorkflowDiffReadView } from "@/modules/types"
import { useWorkflowId } from "./useWorkflowId"

/** The page of one version of a workflow: what it changed against the version before it. */
export interface WorkflowVersion {
    readonly slot: DataSlot<WorkflowDiffReadView>
    readonly retry: () => void
}

/** Reads one version of a workflow against the one before it and words it: the title, the steps, the grants and the map. */
export const useWorkflowVersion = (installationId: string, workflowKey: string, number: number): WorkflowVersion => {
    const t = useTranslations("agentWorkflows")
    const context = useWorkflowContext()
    const workflowId = useWorkflowId(installationId, workflowKey)
    const read = useQueryAgentWorkflowDiffSwr(
        workflowId === "" ? null : { installationId, workflowId, number, against: "previous" },
    )
    const view = useMemo((): WorkflowDiffReadView | undefined => {
        if (read.data === undefined) return undefined
        return {
            title:
                read.data.beforeJson === null
                    ? t("diffFirstTitle", { number })
                    : t("diffVersionTitle", { number, previous: number - 1 }),
            view: diffViewOf(read.data, context),
        }
    }, [read.data, context, t, number])
    const { mutate } = read
    return {
        slot: slotOfSwr<WorkflowDiffReadView>({
            data: view,
            error: read.error,
            isLoading: read.isLoading || view === undefined,
        }),
        retry: () => void mutate(),
    }
}
