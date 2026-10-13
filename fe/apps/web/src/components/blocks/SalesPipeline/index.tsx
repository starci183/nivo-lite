"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useLeadCommands } from "@/hooks/leads"
import { DEAL_STAGES, OPEN_LANES, useSalesActions } from "@/hooks/sales"
import { useSalesWorkbench } from "@/hooks/salesworkbench"
import { useSalesPipelineForm } from "@/hooks/rhf"
import { leadPath } from "@/modules/routes"
import type { LeadStageId, SalesDeal } from "@/modules/types"
import { SalesPipelineBase } from "./component"
import type { DealView, LaneView, MoveDialogView } from "./component"

const MIN_REASON_CHARS = 5
const LANES: ReadonlyArray<LeadStageId> = [...OPEN_LANES, "won", "lost"]
const isClosing = (stage: LeadStageId): boolean => stage === "won" || stage === "lost"
const isStage = (value: string): value is LeadStageId => DEAL_STAGES.some((stage) => stage === value)

/** The pipeline surface: which deal is being moved, to which stage and why live here, the drawing in the pure half. */
export const SalesPipeline = () => {
    const t = useTranslations("workbenchSales")
    const format = useFormatter()
    const commands = useLeadCommands()
    const actions = useSalesActions()
    const { data } = useSalesWorkbench()
    const deals = data?.deals ?? []
    const closedHidden = data?.closedHidden ?? { won: 0, lost: 0 }
    const form = useSalesPipelineForm()
    const { target: selectedTarget, reason } = form.watch()
    const target = selectedTarget || null
    const isPending = actions.isMutating || commands.isMutating || form.formState.isSubmitting
    const [movingId, setMovingId] = useState<string | null>(null)
    const error = form.formState.errors.reason?.message ?? form.formState.errors.target?.message ?? null
    const moving = deals.find((deal) => deal.leadId === movingId) ?? null

    const money = (amount: number): string =>
        format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const compact = (amount: number): string =>
        format.number(amount, { style: "currency", currency: "VND", notation: "compact", maximumFractionDigits: 1 })
    const day = (iso: string): string => format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit" })

    const closedLineOf = (deal: SalesDeal): string =>
        deal.closedReason ? t("closedReason", { reason: deal.closedReason }) : t("closedNoReason")
    const openLineOf = (deal: SalesDeal): string =>
        deal.nextStep ? t("nextStep", { step: deal.nextStep }) : t("nextStepNone")
    const dealOf = (deal: SalesDeal): DealView => {
        const closed = deal.stage === "won" || deal.stage === "lost"
        return {
            leadId: deal.leadId,
            href: leadPath(deal.leadId),
            customer: deal.customer,
            company: deal.company,
            value: deal.valueVnd !== null ? money(deal.valueVnd) : t("noValue"),
            source: deal.valueSource ? t(deal.valueSource === "order" ? "valueOrder" : "valueQuote") : null,
            nextLine: closed ? closedLineOf(deal) : openLineOf(deal),
            isClosed: closed,
            facts: [
                deal.owner ? t("owner", { name: deal.owner }) : t("ownerNone"),
                deal.dueAt && !closed ? t("due", { date: day(deal.dueAt) }) : null,
            ]
                .filter(Boolean)
                .join(" · "),
        }
    }
    const laneOf = (stage: LeadStageId): LaneView => {
        const stageDeals = deals.filter((deal) => deal.stage === stage)
        const hidden = stage === "won" || stage === "lost" ? closedHidden[stage] : 0
        const total = stageDeals.reduce((sum, deal) => sum + (deal.valueVnd ?? 0), 0)
        const count = stageDeals.length + hidden
        return {
            stage,
            title: t(`stage_${stage}`),
            fact: total > 0 ? `${count} · ${compact(total)}` : String(count),
            hiddenText: hidden > 0 ? t("laneMore", { n: hidden }) : null,
            deals: stageDeals.map(dealOf),
        }
    }

    const close = () => {
        setMovingId(null)
        form.reset({ target: "", reason: "" })
    }
    const confirm = form.handleSubmit(async (values) => {
        if (moving === null || !isStage(values.target) || actions.isMutating || commands.isMutating) return
        const result = await commands.recordOutcome(moving.leadId, values.target, values.reason)
        if (result !== undefined) close()
    })

    const needsReason = target !== null && isClosing(target)
    const reasonLabelOf = (stage: LeadStageId | null): string | null => {
        if (stage === null) return null
        if (!needsReason) return t("noteLabel")
        return t(stage === "won" ? "reasonWonLabel" : "reasonLostLabel")
    }
    const dialog: MoveDialogView | null =
        moving === null
            ? null
            : {
                  title: t("moveTitle", { name: moving.customer }),
                  description: t("moveCurrent", { stage: t(`stage_${moving.stage}`) }),
                  options: DEAL_STAGES.filter((stage) => stage !== moving.stage).map((stage) => ({
                      value: stage,
                      label: t(`stage_${stage}`),
                  })),
                  target: target ?? "",
                  isDanger: target === "lost",
                  reasonLabel: reasonLabelOf(target),
                  reasonHint: needsReason ? t("reasonHint", { n: MIN_REASON_CHARS }) : undefined,
                  reasonRequired: needsReason,
                  reason,
                  wonNote: target === "won" ? t("moveWonNote") : null,
                  error,
                  isIncomplete: target === null || (needsReason && reason.trim().length < MIN_REASON_CHARS),
              }

    if (data === null) return null
    return (
        <SalesPipelineBase
            props={{
                label: t("tab_pipeline"),
                lanes: LANES.map(laneOf),
                emptyText: t("laneEmpty"),
                moveLabel: t("moveButton"),
                cancelLabel: t("cancel"),
                confirmLabel: t("moveConfirm"),
                dialog,
                isPending,
            }}
            on={{
                move: (leadId) => setMovingId(leadId),
                target: (value) => form.setValue("target", isStage(value) ? value : ""),
                reason: (value) => form.setValue("reason", value),
                confirm,
                close,
            }}
        />
    )
}
