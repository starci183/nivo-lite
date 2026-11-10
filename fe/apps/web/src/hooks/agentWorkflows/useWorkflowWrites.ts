"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    useMutateAcceptAgentWorkflowTemplateSwr,
    useMutateRollbackAgentWorkflowSwr,
    useMutateSetAgentWorkflowStatusSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import type { WorkflowStatus } from "@/modules/types"
import type { AgentWorkflowsRead } from "./useAgentWorkflows"

/** The commands that write a version or move a workflow. */
export interface WorkflowWrites {
    readonly setStatus: (status: WorkflowStatus) => void
    readonly rollback: (number: number) => void
    /** Syncs the newest template version into the open workflow, as a new version. */
    readonly sync: () => void
    readonly isWriting: boolean
}

/** The commands of the open workflow: stop or start it, go back to an old version, sync from the template. Each reads the lists again. */
export const useWorkflowWrites = (installationId: string, workflows: AgentWorkflowsRead): WorkflowWrites => {
    const t = useTranslations("agentWorkflows")
    const runGraphQL = useGraphQLWithToast()
    const [isWriting, setIsWriting] = useState(false)
    const statusWrite = useMutateSetAgentWorkflowStatusSwr()
    const rollbackWrite = useMutateRollbackAgentWorkflowSwr()
    const acceptWrite = useMutateAcceptAgentWorkflowTemplateSwr()
    const { selected, newer, refresh } = workflows
    const write = (action: () => Promise<unknown>, successMessage: string): void => {
        setIsWriting(true)
        void runGraphQL(action, { successMessage })
            .then(refresh)
            .finally(() => setIsWriting(false))
    }
    return {
        isWriting,
        setStatus: (status) => {
            if (selected !== undefined)
                write(() => statusWrite.trigger({ installationId, workflowId: selected.id, status }), t("statusSet"))
        },
        rollback: (number) => {
            if (selected !== undefined)
                write(
                    () =>
                        rollbackWrite.trigger({
                            installationId,
                            workflowId: selected.id,
                            number,
                            note: t("rollbackNote", { number }),
                            expectedLatest: selected.latestNumber,
                        }),
                    t("rolledBack", { number }),
                )
        },
        sync: () => {
            if (selected !== undefined && newer !== null)
                write(
                    () =>
                        acceptWrite.trigger({
                            installationId,
                            workflowId: selected.id,
                            templateVersion: newer,
                            note: t("syncNote", { version: newer }),
                            expectedLatest: selected.latestNumber,
                        }),
                    t("synced", { version: newer }),
                )
        },
    }
}
