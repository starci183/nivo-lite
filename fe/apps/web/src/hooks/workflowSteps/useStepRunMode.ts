"use client"

import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import { useConnectionsRole } from "@/hooks/connections"
import { useMutateSetAgentNodeModeSwr } from "@/hooks/swr"
import { graphQLErrorCode } from "@/modules/failure"
import { toast } from "@/modules/toast"
import { nodeModeOf } from "@/modules/workflowSteps"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { NodeRightMode, StepRunModeView } from "@/modules/types"

/** The code of the refusal when somebody published a version of the workflow after this page read it. */
const WORKFLOW_CONFLICT_CODE = "AGENT_GRAPHS_WORKFLOW_CONFLICT"

/** What the "how it runs" block of the open step is drawn from and where a change goes. */
interface StepRunModeInput {
    readonly installationId: string
    /** The graph as drawn (the read one, or the draft). */
    readonly spec: GraphSpec | null
    readonly nodeKey: string
    /** The workflow a change writes a new version of, and the newest version number the page read; null when there is none. */
    readonly workflow: { readonly id: string; readonly latestNumber: number } | null
    /** True for the drawer of a run: the block is not drawn there. */
    readonly isRun: boolean
    /** Reads the workflow again (the page then shows the new version), also after a refusal that needs the newer one. */
    readonly reload: () => Promise<unknown>
    /** The choice was written: the drawer's unsaved draft takes it too, so saving it later does not undo it. */
    readonly onChanged: (mode: NodeRightMode) => void
}

/** The block and what choosing does. */
export interface StepRunMode {
    /** Null for the trigger, a control step (no mode declared) and a run's drawer. */
    readonly view: StepRunModeView | null
    readonly choose: (mode: NodeRightMode) => void
}

/**
 * How the open node runs (`auto | ask`, rights.md): the node's mode from the graph, the two choices, and the owner's change as ONE
 * `setAgentNodeMode` call that writes the workflow's next version (`expectedLatest` the version read; runs in flight keep theirs).
 * Anybody who is not the owner reads the mode as words. A refusal for a newer version reloads the workflow and says so in plain words.
 */
export const useStepRunMode = (input: StepRunModeInput): StepRunMode => {
    const t = useTranslations("workflowSteps")
    const role = useConnectionsRole().role
    const write = useMutateSetAgentNodeModeSwr()
    const [isPending, setIsPending] = useState(false)
    const { installationId, nodeKey, workflow, reload, onChanged, spec, isRun } = input
    const mode = nodeModeOf(spec, nodeKey)
    const isOwner = role === "owner"
    const choose = useCallback(
        (next: NodeRightMode) => {
            if (workflow === null || !isOwner || isPending || mode === undefined || next === mode) return
            setIsPending(true)
            const road = async (): Promise<void> => {
                await write.trigger({
                    installationId,
                    workflowId: workflow.id,
                    nodeKey,
                    mode: next,
                    expectedLatest: workflow.latestNumber,
                })
                onChanged(next)
                toast.success(t("runModeSavedTitle"), { description: t("runModeSaved") })
                await reload()
            }
            void road()
                .catch(async (error: unknown) => {
                    if (graphQLErrorCode(error) === WORKFLOW_CONFLICT_CODE) {
                        toast.danger(t("runModeFailed"), { description: t("runModeConflict") })
                        await reload()
                        return
                    }
                    toast.danger(t("runModeFailed"), {
                        description: error instanceof Error && error.message !== "" ? error.message : undefined,
                    })
                })
                .finally(() => setIsPending(false))
        },
        [workflow, isOwner, isPending, mode, write, installationId, nodeKey, onChanged, reload, t],
    )
    const view = useMemo<StepRunModeView | null>(() => {
        if (isRun || mode === undefined) return null
        return {
            title: t("runModeTitle"),
            value: mode,
            options: [
                { id: "auto", label: t("runModeAuto"), description: t("runModeAutoNote") },
                { id: "ask", label: t("runModeAsk"), description: t("runModeAskNote") },
            ],
            isEditable: isOwner && workflow !== null,
            ownerNote: isOwner ? "" : t("runModeOwnerOnly"),
            keepNote: t("runModeKeep"),
            isPending,
        }
    }, [isRun, mode, isOwner, workflow, isPending, t])
    return { view, choose }
}
