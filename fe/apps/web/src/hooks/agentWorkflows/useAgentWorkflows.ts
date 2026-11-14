"use client"

import { useLocale } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import { slotOfSwr } from "@/hooks/slot"
import {
    useQueryAgentWorkflowSwr,
    useQueryAgentWorkflowTemplatePreviewSwr,
    useQueryAgentWorkflowsSwr,
} from "@/hooks/swr"
import { canUpdateFrom, noticeOf, workflowDetailOf, workflowRowOf, type WorkflowWire } from "@/modules/agentWorkflows"
import type { DataSlot, WorkflowDetailView, WorkflowListView } from "@/modules/types"
import { useWorkflowContext } from "./useWorkflowContext"

/** The preview of a newer template version as the back end answers it. */
type PreviewWire = NonNullable<ReturnType<typeof useQueryAgentWorkflowTemplatePreviewSwr>["data"]>

/** The workflows of one agent and the one that is open. */
export interface AgentWorkflowsRead {
    readonly list: DataSlot<WorkflowListView>
    readonly detail: DataSlot<WorkflowDetailView>
    readonly selectedId: string
    readonly select: (id: string) => void
    /** The open workflow, or undefined while none is. */
    readonly selected: WorkflowWire | undefined
    /** The graph of the version the open workflow runs, as JSON text; null while unread. */
    readonly graphJson: string | null
    /** The newer template version the open workflow is offered, or null. */
    readonly newer: number | null
    /** What syncing that version would write. */
    readonly preview: PreviewWire | undefined
    /** Reads all three again. */
    readonly refresh: () => Promise<void>
}

const NO_CHANGES: PreviewWire["changes"] = []

/** The newer template version a workflow is offered, or null when it is on the newest or has no template. */
const newerOf = (workflow: WorkflowWire | undefined): number | null => {
    const latest = workflow?.templateLatest ?? null
    const version = workflow?.templateVersion ?? null
    // A workflow whose template version is gone has nothing to preview or accept: no read is issued for it.
    return workflow !== undefined && canUpdateFrom(workflow) && latest !== null && version !== null && latest > version ? latest : null
}

/** The workflows of one agent: the list, the open one with its history and the notice that its template has a newer version. */
export const useAgentWorkflows = (installationId: string): AgentWorkflowsRead => {
    const locale = useLocale()
    const context = useWorkflowContext()
    const [pickedId, setPickedId] = useState("")
    const list = useQueryAgentWorkflowsSwr({ installationId, locale })
    const selected = list.data?.find((workflow) => workflow.id === pickedId) ?? list.data?.[0]
    const read = useQueryAgentWorkflowSwr(selected === undefined ? null : { installationId, workflowId: selected.id, locale })
    const newer = newerOf(selected)
    const preview = useQueryAgentWorkflowTemplatePreviewSwr(
        selected === undefined || newer === null ? null : { installationId, workflowId: selected.id, templateVersion: newer, locale },
        { shouldRetryOnError: false },
    )
    const { mutate: reloadList } = list
    const { mutate: reloadDetail } = read
    const { mutate: reloadPreview } = preview
    const refresh = useCallback(async () => {
        await Promise.all([reloadList(), reloadDetail(), reloadPreview()])
    }, [reloadList, reloadDetail, reloadPreview])
    const detailView = useMemo(
        () =>
            read.data === undefined || selected === undefined
                ? undefined
                : workflowDetailOf(
                      read.data,
                      noticeOf(selected, preview.data?.changes ?? NO_CHANGES, preview.data?.diff.steps.length ?? null, context),
                      context,
                  ),
        [read.data, selected, preview.data, context],
    )
    return {
        list: slotOfSwr<WorkflowListView>({
            data: list.data === undefined ? undefined : { rows: list.data.map((workflow) => workflowRowOf(workflow, context)) },
            error: list.error,
            isLoading: list.isLoading,
        }),
        detail: slotOfSwr<WorkflowDetailView>({
            data: detailView,
            error: read.error,
            isLoading: list.isLoading || (selected !== undefined && read.isLoading),
        }),
        selectedId: selected?.id ?? "",
        select: setPickedId,
        selected,
        graphJson: read.data?.graphJson ?? null,
        newer,
        preview: preview.data,
        refresh,
    }
}
