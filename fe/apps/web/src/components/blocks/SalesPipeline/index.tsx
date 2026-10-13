"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { DEAL_STAGES, OPEN_LANES } from "@/hooks/sales"
import { useLeadCommands } from "@/hooks/leads"
import { faultTextOf } from "@/hooks/leadJourney"
import { navigation } from "@/modules/i18n"
import { leadPath } from "@/modules/routes"
import type { LeadStageId, SalesDeal } from "@/modules/types"
import { SalesPipelineBase } from "./component"
import type { DealView, LaneView, MoveDialogView } from "./component"

const MIN_REASON_CHARS = 5
const LANES: ReadonlyArray<LeadStageId> = [...OPEN_LANES, "won", "lost"]
const isClosing = (stage: LeadStageId): boolean => stage === "won" || stage === "lost"
const isStage = (value: string): value is LeadStageId => DEAL_STAGES.some((stage) => stage === value)

/** The deals on the board and the workspace they belong to. */
interface SalesPipelineProps {
    readonly deals: ReadonlyArray<SalesDeal>
    readonly closedHidden: { readonly won: number; readonly lost: number }
    readonly workspaceId: string
}

/** The pipeline surface: which deal is being moved, to which stage and why live here, the drawing in the pure half. */
export const SalesPipeline = (props: SalesPipelineProps) => {
    const t = useTranslations("workbenchSales")
    const format = useFormatter()
    const router = navigation.useRouter()
    const commands = useLeadCommands(props.workspaceId)
    const [isPending, startTransition] = useTransition()
    const [movingId, setMovingId] = useState<string | null>(null)
    const [target, setTarget] = useState<LeadStageId | null>(null)
    const [reason, setReason] = useState("")
    const [error, setError] = useState<string | null>(null)
    const moving = props.deals.find((deal) => deal.leadId === movingId) ?? null

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
        const deals = props.deals.filter((deal) => deal.stage === stage)
        const hidden = stage === "won" || stage === "lost" ? props.closedHidden[stage] : 0
        const total = deals.reduce((sum, deal) => sum + (deal.valueVnd ?? 0), 0)
        const count = deals.length + hidden
        return {
            stage,
            title: t(`stage_${stage}`),
            fact: total > 0 ? `${count} · ${compact(total)}` : String(count),
            hiddenText: hidden > 0 ? t("laneMore", { n: hidden }) : null,
            deals: deals.map(dealOf),
        }
    }

    const close = () => {
        setMovingId(null)
        setTarget(null)
        setReason("")
        setError(null)
    }
    const confirm = () => {
        if (moving === null || target === null) return
        setError(null)
        startTransition(async () => {
            const result = await commands.recordOutcome(moving.leadId, target, reason.trim())
            if (result.kind === "ok") {
                close()
                router.refresh()
            } else setError(t("actionFailed", { error: faultTextOf(result) }))
        })
    }

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
                target: (value) => setTarget(isStage(value) ? value : null),
                reason: setReason,
                confirm,
                close,
            }}
        />
    )
}
