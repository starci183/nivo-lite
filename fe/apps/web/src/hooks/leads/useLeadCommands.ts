"use client"

import { useTranslations } from "next-intl"
import {
    useMutateAddResponsibilitySwr,
    useMutateAssignResponsibilitySwr,
    useMutateRecordOutcomeSwr,
    useMutateSettleWonDealSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import type { LeadStageId } from "@/modules/types"
import { useLeadAction } from "./useLeadAction"
import { useRevalidateLeadViews } from "./useRevalidateLeadViews"

interface StepInput {
    readonly owner: string
    readonly nextAction: string
    readonly dueAt: string | null
}

/** The view `useLeadCommands` returns. */
export interface LeadCommandsView {
    isMutating: boolean
    recordOutcome: (
        leadId: string,
        stage: LeadStageId,
        evidence: string,
    ) => Promise<
        | {
              channel: string
              company: string
              contactName: string
              handedToAccounting: boolean
              leadId: string
              need: string
              stage: string
          }
        | undefined
    >
    addResponsibility: (
        leadId: string,
        title: string,
        input: StepInput,
    ) => Promise<
        | {
              dueAt: string | null
              id: string
              leadId: string
              nextAction: string
              ownerAgentId: string | null
              ownerKind: string
              ownerName: string
              status: string
              title: string
          }
        | undefined
    >
    assignResponsibility: (
        responsibilityId: string,
        input: StepInput,
    ) => Promise<
        | {
              dueAt: string | null
              id: string
              leadId: string
              nextAction: string
              ownerAgentId: string | null
              ownerKind: string
              ownerName: string
              status: string
              title: string
          }
        | undefined
    >
}

/** Lead mutations toast their result and refresh affected views. */
export const useLeadCommands = (): LeadCommandsView => {
    const t = useTranslations("lead")
    const withToast = useGraphQLWithToast()
    const outcome = useMutateRecordOutcomeSwr()
    const add = useMutateAddResponsibilitySwr()
    const assign = useMutateAssignResponsibilitySwr()
    const settle = useMutateSettleWonDealSwr()
    const settlement = useLeadAction()
    const revalidate = useRevalidateLeadViews()
    return {
        isMutating: outcome.isMutating || add.isMutating || assign.isMutating || settlement.isPending,
        recordOutcome: async (leadId: string, stage: LeadStageId, evidence: string) => {
            const result = await withToast(() => outcome.trigger({ leadId, stage, evidence }), {
                successMessage: t("outcomeRecorded"),
            })
            if (result !== undefined) await revalidate()
            if (result !== undefined && stage === "won") {
                await settlement.run(() => settle.trigger({ leadId, evidence }))
            }
            return result
        },
        addResponsibility: async (leadId: string, title: string, input: StepInput) => {
            const result = await withToast(() => add.trigger({ leadId, title, ...input }), {
                successMessage: t("changesSaved"),
            })
            if (result !== undefined) await revalidate()
            return result
        },
        assignResponsibility: async (responsibilityId: string, input: StepInput) => {
            const result = await withToast(() => assign.trigger({ responsibilityId, ...input }), {
                successMessage: t("changesSaved"),
            })
            if (result !== undefined) await revalidate()
            return result
        },
    }
}

/** Commands shared by the persistent workbench and its pipeline panel. */
export type LeadCommands = ReturnType<typeof useLeadCommands>
