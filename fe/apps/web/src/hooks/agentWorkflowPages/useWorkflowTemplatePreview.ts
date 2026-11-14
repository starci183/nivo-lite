"use client"

import { useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryAgentWorkflowTemplatePreviewSwr, useQueryAgentWorkflowsSwr } from "@/hooks/swr"
import { useWorkflowContext } from "@/hooks/agentWorkflows"
import { diffViewOf } from "@/modules/agentWorkflows"
import type { DataSlot, WorkflowDiffReadView } from "@/modules/types"

/** The page of a newer template version of a workflow: what updating to it would change. */
export interface WorkflowTemplatePreview {
    readonly slot: DataSlot<WorkflowDiffReadView>
    readonly retry: () => void
}

/**
 * Reads what accepting template version `templateVersion` would write into the workflow (`agentWorkflowTemplatePreview`) and words it
 * as the page of a version: the steps, the rights (the node rights added, removed and loosened among them) and the map.
 */
export const useWorkflowTemplatePreview = (
    installationId: string,
    workflowKey: string,
    templateVersion: number,
): WorkflowTemplatePreview => {
    const t = useTranslations("agentWorkflows")
    const locale = useLocale()
    const context = useWorkflowContext()
    const list = useQueryAgentWorkflowsSwr({ installationId, locale })
    const workflow = list.data?.find((one) => one.key === workflowKey || one.id === workflowKey)
    const read = useQueryAgentWorkflowTemplatePreviewSwr(
        workflow === undefined || templateVersion < 1
            ? null
            : { installationId, workflowId: workflow.id, templateVersion, locale },
        { shouldRetryOnError: false },
    )
    const view = useMemo((): WorkflowDiffReadView | undefined => {
        if (read.data === undefined || workflow === undefined) return undefined
        return {
            title: t("previewTitle", { version: templateVersion, number: workflow.latestNumber }),
            view: diffViewOf(read.data.diff, context),
        }
    }, [read.data, workflow, context, t, templateVersion])
    const { mutate } = read
    return {
        slot: slotOfSwr<WorkflowDiffReadView>({
            data: view,
            error: read.error ?? list.error,
            isLoading: list.isLoading || read.isLoading || view === undefined,
        }),
        retry: () => void mutate(),
    }
}
