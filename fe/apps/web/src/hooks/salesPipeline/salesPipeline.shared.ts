import type { useFormatter, useTranslations } from "next-intl"
import type { Dispatch, SetStateAction } from "react"
import type { useLeadCommands } from "@/hooks/leads"
import type { useGraphQLWithToast } from "@/modules/toast"
import { DEAL_STAGES, OPEN_LANES, stageWordOf } from "@/hooks/sales"
import type { useSalesPipelineForm } from "@/hooks/rhf"
import { leadPath } from "@/modules/routes"
import type { DealView, LaneView, LeadStageId, SalesDeal, SalesWorkbenchData } from "@/modules/types"

/** A local command origin, distinct from any later activation of this dialog. */
export interface PipelineOperation {
    readonly scope: string
    readonly isCurrent: () => boolean
}

/** The real pipeline data, form and command dependencies used to resolve its view. */
export interface SalesPipelineControllerInput {
    readonly t: ReturnType<typeof useTranslations<"workbenchSales">>
    readonly format: ReturnType<typeof useFormatter>
    readonly commands: ReturnType<typeof useLeadCommands>
    readonly runGraphQL: ReturnType<typeof useGraphQLWithToast>
    readonly deals: SalesWorkbenchData["deals"]
    readonly closedHidden: SalesWorkbenchData["closedHidden"]
    readonly form: ReturnType<typeof useSalesPipelineForm>
    readonly reason: string
    readonly target: LeadStageId | null
    readonly isPending: boolean
    readonly movingId: string | null
    readonly setMovingId: Dispatch<SetStateAction<string | null>>
    readonly scope: string
    readonly capture: () => () => boolean
    readonly setOperation: Dispatch<SetStateAction<PipelineOperation | null>>
}

/** Minimum explanation length accepted when closing a deal. */
export const MIN_REASON_CHARS = 5

/** Pipeline display order, including closed outcomes after open stages. */
export const LANES: ReadonlyArray<LeadStageId> = [...OPEN_LANES, "won", "lost"]

/** Identifies stages that require the closing flow. */
export const isClosing = (stage: LeadStageId): boolean => stage === "won" || stage === "lost"

const STAGE_IDS: ReadonlySet<string> = new Set(DEAL_STAGES)

/** Checks untrusted stage values against the supported deal stages. */
export const isStage = (value: string): value is LeadStageId => {
    return STAGE_IDS.has(value)
}

type CreateSalesPipelineStateResult = {
    error: string | null
    moving: SalesDeal | null
    laneOf: (stage: LeadStageId) => LaneView
    t: ReturnType<typeof useTranslations<"workbenchSales">>
    format: ReturnType<typeof useFormatter>
    commands: ReturnType<typeof useLeadCommands>
    runGraphQL: ReturnType<typeof useGraphQLWithToast>
    deals: SalesWorkbenchData["deals"]
    closedHidden: SalesWorkbenchData["closedHidden"]
    form: ReturnType<typeof useSalesPipelineForm>
    reason: string
    target: LeadStageId | null
    isPending: boolean
    movingId: string | null
    setMovingId: Dispatch<SetStateAction<string | null>>
    scope: string
    capture: () => () => boolean
    setOperation: Dispatch<SetStateAction<PipelineOperation | null>>
}

/** Resolves pipeline display data from the current deals and form state. */
export const createSalesPipelineState = (input: SalesPipelineControllerInput): CreateSalesPipelineStateResult => {
    const { t, format, deals, closedHidden, form, movingId } = input

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
    const valueSourceOf = (source: SalesDeal["valueSource"]): string | null => {
        if (!source) return null
        return t(source === "order" ? "valueOrder" : "valueQuote")
    }
    const dealOf = (deal: SalesDeal): DealView => {
        const closed = deal.stage === "won" || deal.stage === "lost"
        return {
            leadId: deal.leadId,
            href: leadPath(deal.leadId),
            customer: deal.customer,
            company: deal.company,
            value: deal.valueVnd !== null ? money(deal.valueVnd) : t("noValue"),
            source: valueSourceOf(deal.valueSource),
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
            title: stageWordOf(t, stage),
            fact: total > 0 ? `${count} · ${compact(total)}` : String(count),
            hiddenText: hidden > 0 ? t("laneMore", { n: hidden }) : null,
            deals: stageDeals.map(dealOf),
        }
    }
    return { ...input, error, moving, laneOf }
}
