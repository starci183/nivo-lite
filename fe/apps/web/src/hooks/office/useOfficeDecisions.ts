"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import {
    useMutateCancelOfficeCommandSwr,
    useMutateConfirmOfficeCommandSwr,
    useMutateDecideExecutionSwr,
    useMutateDecideWorkItemSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import type { OfficeWorkDecision } from "@/modules/types"
import { refreshOffice } from "./office.shared"

type UseOfficeDecisionsResult = {
    busyId: string | null
    alreadyIds: readonly string[]
    decideApproval: (
        executionId: string,
        decision: "approved" | "rejected",
        editedDraft: string | null,
    ) => Promise<void>
    decideWork: (workItemId: string, choice: OfficeWorkDecision) => Promise<void>
    confirmCommand: (candidateId: string) => Promise<void>
    cancelCommand: (candidateId: string) => Promise<void>
}

/** The decisions of the Office: approvals, exceptions and command cards. `busyId` names the card being worked on. */
export const useOfficeDecisions = (): UseOfficeDecisionsResult => {
    const t = useTranslations("office")
    const runGraphQL = useGraphQLWithToast()
    const decideExecution = useMutateDecideExecutionSwr()
    const decideWorkItem = useMutateDecideWorkItemSwr()
    const confirm = useMutateConfirmOfficeCommandSwr()
    const cancel = useMutateCancelOfficeCommandSwr()
    const [busyId, setBusyId] = useState<string | null>(null)
    const [alreadyIds, setAlreadyIds] = useState<ReadonlyArray<string>>([])

    const decideApproval = useCallback(
        async (executionId: string, decision: "approved" | "rejected", editedDraft: string | null): Promise<void> => {
            setBusyId(executionId)
            const done = await runGraphQL(() => decideExecution.trigger({ executionId, decision, editedDraft }), {
                successMessage: t(decision === "approved" ? "approvalSaved" : "rejectionSaved"),
            })
            if (done !== undefined) await refreshOffice()
            setBusyId(null)
        },
        [runGraphQL, decideExecution, t],
    )

    const decideWork = useCallback(
        async (workItemId: string, choice: OfficeWorkDecision): Promise<void> => {
            setBusyId(workItemId)
            const edits = {
                draft: choice.draft,
                amount_vnd: choice.amountVnd,
                candidateId: choice.candidateId,
                fields: choice.fields.map((field) => ({ name: field.key, text: field.value })),
            }
            const done = await runGraphQL(
                () =>
                    decideWorkItem.trigger({
                        workItemId,
                        decision: choice.decision,
                        basis: choice.basis,
                        edits: choice.decision === "approved" ? edits : null,
                    }),
                { successMessage: t(choice.decision === "approved" ? "approvalSaved" : "rejectionSaved") },
            )
            if (done !== undefined) await refreshOffice()
            setBusyId(null)
        },
        [runGraphQL, decideWorkItem, t],
    )

    const confirmCommand = useCallback(
        async (candidateId: string): Promise<void> => {
            setBusyId(candidateId)
            const sent = await runGraphQL(() => confirm.trigger({ candidateId }), { successMessage: t("cmdSentBadge") })
            if (sent !== undefined) {
                if (!sent.created) setAlreadyIds((current) => [...current, candidateId])
                await refreshOffice()
            }
            setBusyId(null)
        },
        [runGraphQL, confirm, t],
    )

    const cancelCommand = useCallback(
        async (candidateId: string): Promise<void> => {
            setBusyId(candidateId)
            const done = await runGraphQL(() => cancel.trigger({ candidateId }), {
                successMessage: t("cmdCancelledBadge"),
            })
            if (done !== undefined) await refreshOffice()
            setBusyId(null)
        },
        [runGraphQL, cancel, t],
    )

    return { busyId, alreadyIds, decideApproval, decideWork, confirmCommand, cancelCommand }
}
