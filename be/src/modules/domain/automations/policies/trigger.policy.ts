import type { EventData, ShopWithHours } from "../automations.contracts"
import type { PipelineConfig } from "@modules/domain/automation-pipelines"

/** One day in milliseconds. */
export const DAY_MS = 86_400_000

/** The wait before the thank-you: the built-in care message after a payment is queued right behind the event, and the thank-you looks for it first. */
const THANK_DELAY_MS = 90_000

/** The events whose rows the spreadsheet automation records. */
const SHEET_EVENTS: ReadonlySet<string> = new Set(["order.confirmed", "deal.won", "payment.received", "lead.created"])

/** How one business event starts a run. */
export interface TriggerPlan {
    /** Unique per trigger: the same key never runs twice. */
    readonly dedupe: string
    /** What the run is about. */
    readonly triggerRef: string
    /** What the run is executed from. */
    readonly payload: Readonly<Record<string, unknown>>
    /** How long to wait before the run is due, in milliseconds. */
    readonly delayMs: number
}

/** The business event and the pipeline it may start. */
export interface TriggerInput {
    /** The template key of the pipeline. */
    readonly templateKey: string
    /** The event name. */
    readonly event: string
    /** What the event carries. */
    readonly data: Readonly<Record<string, unknown>>
    /** The dedupe key of the event. */
    readonly dedupe: string
    /** The settings of the pipeline. */
    readonly config: PipelineConfig
    /** The instant of the event. */
    readonly at: Date
    /** The shop, for the opening hours. */
    readonly shop: ShopWithHours
}

/** What a reported event carries, copied as a record. */
export const eventDataOf = (data: object): EventData => Object.fromEntries(Object.entries(data))

/** A value of the event as text; anything missing is empty. */
export const textOf = (value: unknown): string => {
    if (typeof value === "string") return value
    return typeof value === "number" || typeof value === "boolean" ? String(value) : ""
}

const plan = (
    dedupe: string,
    triggerRef: string,
    payload: Readonly<Record<string, unknown>>,
    delayMs = 0,
): TriggerPlan => ({ dedupe, triggerRef, payload, delayMs })

/** The run an event starts for a pipeline, or null when this pipeline does not react to it. */
export const planTrigger = (input: TriggerInput): TriggerPlan | null => {
    const { templateKey, event, data, dedupe, config } = input
    const at = input.at.toISOString()
    if (templateKey === "thank_payment" && event === "payment.received") {
        return plan(`thank:${dedupe}`, textOf(data.invoice_id), { ...data, at }, THANK_DELAY_MS)
    }
    if (templateKey === "ask_review" && event === "payment.received") {
        return plan(`review:${dedupe}`, textOf(data.lead_id), { ...data }, (Number(config.afterDays) || 1) * DAY_MS)
    }
    if (templateKey === "delivery_notice" && event === "order.shipped") {
        return plan(`ship:${dedupe}`, textOf(data.order_id), { ...data })
    }
    if (templateKey === "contract_renewal" && event === "contract.expiring") {
        return plan(`renew:${dedupe}`, textOf(data.contract_id), { ...data })
    }
    if (templateKey === "sheet_orders" && SHEET_EVENTS.has(event)) {
        return plan(`sheet:${dedupe}`, textOf(data.order_no) || textOf(data.lead_id), { event, data, at })
    }
    return null
}
