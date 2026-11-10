"use client"

import { useLocale } from "next-intl"
import { useMemo, useState } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryWorkflowTemplatesSwr } from "@/hooks/swr"
import { templateDetailOf, templateRowOf } from "@/modules/agentWorkflows"
import type { DataSlot, WorkflowTemplateDetailView, WorkflowTemplateRowView } from "@/modules/types"
import { useWorkflowContext } from "./useWorkflowContext"

/** The workflow templates of the market and the one the person opened. */
export interface WorkflowTemplatesData {
    readonly slot: DataSlot<ReadonlyArray<WorkflowTemplateRowView>>
    readonly openId: string
    readonly open: (id: string) => void
    readonly close: () => void
    readonly detail: WorkflowTemplateDetailView | null
    readonly reload: () => void
}

/** The workflow templates of every kind of agent, each with its map and its changelog once opened. */
export const useWorkflowTemplates = (): WorkflowTemplatesData => {
    const locale = useLocale()
    const context = useWorkflowContext()
    const [openId, setOpenId] = useState("")
    const read = useQueryWorkflowTemplatesSwr({ locale })
    const rows = useMemo(() => read.data?.map((template) => templateRowOf(template, context)), [read.data, context])
    const opened = read.data?.find((template) => template.id === openId)
    return {
        slot: slotOfSwr<ReadonlyArray<WorkflowTemplateRowView>>({ data: rows, error: read.error, isLoading: read.isLoading }),
        openId,
        open: setOpenId,
        close: () => setOpenId(""),
        detail: opened === undefined ? null : templateDetailOf(opened, context),
        reload: () => void read.mutate(),
    }
}
