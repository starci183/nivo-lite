import type { DebtInvoice, ScannedLead } from "../automations.contracts"
import type { PipelineConfig } from "@modules/domain/automation-pipelines"
import type { PriorRunRow } from "@modules/domain/automation-runs"
import { hhmmToMinutes, vnClock } from "./hours.policy"
import { DAY_MS } from "./trigger.policy"

/** The most runs one scan or one tick starts for a pipeline. */
export const BATCH = 8
const HOUR_MS = 3_600_000
const NURTURE_LOOKBACK_DAYS = 30
const WIN_BACK_LOOKBACK_DAYS = 365
const DEBT_REMINDERS_MAX = 2
const CONTRACT_DEFAULT_DAYS = 14
const CONTRACT_MAX_DAYS = 90
const SCHEDULE_WINDOW_MINUTES = 180

/** A run a scan decided to start. */
export interface ScanPlan {
    /** Unique per trigger. */
    readonly dedupe: string
    /** What the run is about. */
    readonly triggerRef: string
    /** What the run is executed from. */
    readonly payload: Readonly<Record<string, unknown>>
}

/** A business event a scan announces; the engine evaluates it like any other event. */
export interface ScanAnnouncement {
    /** Unique per occurrence. */
    readonly dedupe: string
    /** What the event carries. */
    readonly data: Readonly<Record<string, unknown>>
}

/** What a scan decided to start: runs of its own, and events to announce. */
export interface ScanPlans {
    /** Runs to start for the pipeline. */
    readonly runs: ReadonlyArray<ScanPlan>
    /** Events to announce. */
    readonly events: ReadonlyArray<ScanAnnouncement>
}

/** A scan that found nothing to start. */
export const NO_SCAN: ScanPlans = { runs: [], events: [] }

/** How many real runs a thing had, when the last was, and whether one is still open. */
export interface Seen {
    /** The runs that neither skipped nor failed. */
    readonly n: number
    /** The instant of the latest, in epoch milliseconds. */
    readonly last: number
    /** True while a run waits for a decision or is queued or running. */
    readonly waiting: boolean
}

/** The history of a pipeline for the things a scan looks at. */
export interface PriorRuns {
    /** The runs per trigger reference. */
    readonly seen: ReadonlyMap<string, Seen>
    /** Every dedupe key already used, even by skipped runs. */
    readonly used: ReadonlySet<string>
}

const NOTHING: Seen = { n: 0, last: 0, waiting: false }
const OPEN: ReadonlyArray<string> = ["waiting_approval", "queued", "running"]

/** Groups the history rows per trigger reference. */
export const priorRunsOf = (rows: ReadonlyArray<PriorRunRow>): PriorRuns => {
    const seen = new Map<string, Seen>()
    const used = new Set<string>()
    for (const row of rows) {
        used.add(row.dedupe_key)
        if (row.status === "skipped" || row.status === "failed") continue
        const current = seen.get(row.trigger_ref) ?? NOTHING
        seen.set(row.trigger_ref, {
            n: current.n + 1,
            last: Math.max(current.last, Date.parse(row.created_at)),
            waiting: current.waiting || OPEN.includes(row.status),
        })
    }
    return { seen, used }
}

/** The instant a lead scan reaches back to. */
export const lookbackIso = (now: Date, kind: "nurture" | "win_back"): string =>
    new Date(
        now.getTime() - (kind === "nurture" ? NURTURE_LOOKBACK_DAYS : WIN_BACK_LOOKBACK_DAYS) * DAY_MS,
    ).toISOString()

/** The leads of a scan that are due a nudge ("nurture") or an invitation back ("win_back"). */
export const planLeadScan = (
    kind: "nurture" | "win_back",
    leads: ReadonlyArray<ScannedLead>,
    activity: ReadonlyMap<string, number>,
    withChat: ReadonlySet<string>,
    prior: PriorRuns,
    config: PipelineConfig,
    now: Date,
    batch: number,
): ReadonlyArray<ScanPlan> => {
    const quietMs = (kind === "nurture" ? Number(config.afterHours) : Number(config.afterDays) * 24) * HOUR_MS
    const month = vnClock(now).day.slice(0, 7)
    const plans: Array<ScanPlan> = []
    for (const lead of leads) {
        if (plans.length >= batch) break
        if (!withChat.has(lead.id) || now.getTime() - (activity.get(lead.id) ?? 0) < quietMs) continue
        const seen = prior.seen.get(lead.id) ?? NOTHING
        if (seen.waiting || (seen.n > 0 && now.getTime() - seen.last < quietMs)) continue
        if (kind === "nurture") {
            const k = seen.n + 1
            const dedupe = `nurture:${lead.id}:${k}`
            if (k > Number(config.maxFollowUps) || prior.used.has(dedupe)) continue
            plans.push({ dedupe, triggerRef: lead.id, payload: { lead_id: lead.id, k, dedupe } })
        } else {
            const dedupe = `winback:${lead.id}:${month}`
            if (seen.n > 0 || prior.used.has(dedupe)) continue
            plans.push({ dedupe, triggerRef: lead.id, payload: { lead_id: lead.id, dedupe } })
        }
    }
    return plans
}

/** The instant before which an invoice counts as overdue for a reminder. */
export const debtCutoffIso = (now: Date, config: PipelineConfig): string =>
    new Date(now.getTime() - Number(config.afterDays) * DAY_MS).toISOString()

/** The overdue invoices due a reminder: the customer has a chat, no reminder is open, at most two were sent and the gap has passed. */
export const planDebtScan = (
    invoices: ReadonlyArray<DebtInvoice>,
    withChat: ReadonlySet<string>,
    prior: PriorRuns,
    config: PipelineConfig,
    now: Date,
    batch: number,
): ReadonlyArray<ScanPlan> => {
    const gapMs = Number(config.afterDays) * DAY_MS
    const plans: Array<ScanPlan> = []
    for (const invoice of invoices) {
        if (plans.length >= batch) break
        if (invoice.leadId === null || !withChat.has(invoice.leadId)) continue
        const seen = prior.seen.get(invoice.id) ?? NOTHING
        if (seen.waiting || seen.n >= DEBT_REMINDERS_MAX) continue
        if (seen.n > 0 && now.getTime() - seen.last < gapMs) continue
        const k = seen.n + 1
        const dedupe = `debt:${invoice.id}:${k}`
        if (prior.used.has(dedupe)) continue
        plans.push({
            dedupe,
            triggerRef: invoice.id,
            payload: {
                invoice_id: invoice.id,
                invoice_no: invoice.invoiceNo,
                amount_vnd: invoice.amountVnd,
                lead_id: invoice.leadId,
                k,
                dedupe,
            },
        })
    }
    return plans
}

/** The day report is due once the configured time of the Vietnam day has passed; it runs once a day. */
export const planDailyReport = (config: PipelineConfig, now: Date): ScanPlan | null => {
    const clock = vnClock(now)
    return clock.minute >= hhmmToMinutes(String(config.time))
        ? { dedupe: `daily:${clock.day}`, triggerRef: clock.day, payload: { day: clock.day } }
        : null
}

/** The days a contract renewal scan covers. */
export interface ContractWindow {
    /** Today in Vietnam time, `yyyy-mm-dd`. */
    readonly today: string
    /** The last day covered. */
    readonly horizon: string
}

/** The first and last day a contract renewal scan looks at: today until `beforeDays` ahead. */
export const contractWindow = (now: Date, config: PipelineConfig): ContractWindow => {
    const today = vnClock(now).day
    const before = Math.max(1, Math.min(CONTRACT_MAX_DAYS, Number(config.beforeDays) || CONTRACT_DEFAULT_DAYS))
    return { today, horizon: new Date(Date.parse(`${today}T00:00:00Z`) + before * DAY_MS).toISOString().slice(0, 10) }
}

/** A contract that is about to end. */
export interface ExpiringContract {
    /** The contract id. */
    readonly id: string
    /** The last day, `yyyy-mm-dd`. */
    readonly endsOn: string
}

/** The expiring contracts this pipeline has not announced for their current end date. */
export const planContractScan = (
    contracts: ReadonlyArray<ExpiringContract>,
    used: ReadonlySet<string>,
    today: string,
    batch: number,
): ReadonlyArray<ScanAnnouncement> =>
    contracts
        .filter((contract) => !used.has(`renew:contract.expiring:${contract.id}:${contract.endsOn}`))
        .slice(0, batch)
        .map((contract) => ({
            dedupe: `contract.expiring:${contract.id}:${contract.endsOn}`,
            data: {
                contract_id: contract.id,
                ends_on: contract.endsOn,
                days_left: Math.round(
                    (Date.parse(`${contract.endsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS,
                ),
            },
        }))

/** The month before the one a day (`yyyy-mm-dd`) is in, as `yyyy-mm`. */
export const previousMonth = (day: string): string =>
    new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7)

/** What a scheduled pipeline starts now. */
export interface N8nSchedulePlan {
    /** The data the workflow runs with. */
    readonly data: Readonly<Record<string, unknown>>
    /** Unique per day (or month): a double tick or a catch-up starts nothing twice. */
    readonly dedupe: string
}

/**
 * The run a scheduled pipeline starts at this tick, in Vietnam time. A daily template runs in the three hours after its configured
 * time; a monthly one only on the first day of the month, for the month before. Null when it is not due.
 */
export const planN8nSchedule = (triggerEvent: string, config: PipelineConfig, now: Date): N8nSchedulePlan | null => {
    const clock = vnClock(now)
    const at = hhmmToMinutes(String(config.time || "00:00"))
    if (clock.minute < at || clock.minute >= at + SCHEDULE_WINDOW_MINUTES) return null
    if (triggerEvent !== "schedule.monthly") return { data: { date: clock.day }, dedupe: `day:${clock.day}` }
    if (!clock.day.endsWith("-01")) return null
    const period = previousMonth(clock.day)
    return { data: { period }, dedupe: `month:${period}` }
}
