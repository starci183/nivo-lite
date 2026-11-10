"use client"

import { useLocale } from "next-intl"
import { useMemo } from "react"
import {
    useAgentWorkflows,
    useWorkflowContext,
    useWorkflowCreate,
    type WorkflowCreateData,
} from "@/hooks/agentWorkflows"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryAgentWorkflowGraphSwr, useQueryAgentWorkflowsSwr } from "@/hooks/swr"
import { tableRowOf } from "@/modules/agentWorkflowPages"
import { navigation } from "@/modules/i18n"
import type { DataSlot, WorkflowTableRowView } from "@/modules/types"

/** The workflows of one agent as the rows of its table, and the maker that creates one from a template. */
export interface WorkflowsHome {
    readonly slot: DataSlot<ReadonlyArray<WorkflowTableRowView>>
    readonly create: WorkflowCreateData
    readonly retry: () => void
}

/** The table of the workflows of an agent: each row with what starts it, what it ends with and who may call it, read from the contracts. */
export const useWorkflowsHome = (module: string, installationId: string): WorkflowsHome => {
    const locale = useLocale()
    const pathname = navigation.usePathname()
    const context = useWorkflowContext()
    const read = useQueryAgentWorkflowsSwr({ installationId, locale })
    const contracts = useQueryAgentWorkflowGraphSwr(installationId)
    const workflows = useAgentWorkflows(installationId)
    const create = useWorkflowCreate({
        module,
        installationId,
        refresh: workflows.refresh,
        onCreated: workflows.select,
    })
    const rows = useMemo(
        () =>
            read.data?.map((workflow) =>
                tableRowOf({
                    workflow,
                    base: pathname,
                    context,
                    read: contracts.data?.workflows.find((one) => one.id === workflow.id),
                }),
            ),
        [read.data, contracts.data, pathname, context],
    )
    return {
        slot: slotOfSwr<ReadonlyArray<WorkflowTableRowView>>({
            data: rows,
            error: read.error,
            isLoading: read.isLoading,
        }),
        create,
        retry: () => void read.mutate(),
    }
}
