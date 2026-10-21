import type { useFormatter, useTranslations } from "next-intl"
import type { Governance, WaitingWork } from "@/hooks/overviewFigures"
import type { ReasonCode } from "@/modules/types"

/** The translator of one catalog namespace. */
export type GovTranslator = ReturnType<typeof useTranslations>

/** The reader's number and date formatter (next-intl, product time zone). */
export type GovFormat = ReturnType<typeof useFormatter>

const EXCEPTION_ORDER: ReadonlyArray<ReasonCode> = ["missing_data", "over_authority", "unclear_outcome", "not_allowed"]
/** How many waiting items the overview lists. */
export const TOP_WAITING = 3
const TOP_HISTORY = 5

/** One department tile of the summary. */
export interface GovDepartment {
    readonly id: string
    readonly name: string
    readonly done: string
    readonly waiting: string
    readonly hasWaiting: boolean
    readonly last: string
    readonly label: string
}

/** One waiting item. */
export interface GovWaitingItem {
    readonly id: string
    readonly title: string
    readonly department: string
    readonly reason: string | null
    readonly summary: string | null
}

/** One decision of the history. */
export interface GovHistoryRow {
    readonly id: string
    readonly action: string
    readonly outcome: string
    readonly outcomeTone: "success" | "accent" | "warning" | "danger"
    readonly when: string
    readonly exact: string
    readonly detail: string
}

/** One exception count. */
export interface GovExceptionChip {
    readonly id: string
    readonly label: string
    readonly tone: "warning" | "danger"
}

const OUTCOME_TONES: Readonly<Record<string, GovHistoryRow["outcomeTone"]>> = {
    auto_done: "success",
    approved: "accent",
    edited: "warning",
}

/** A relative time ("5 minutes ago") for recent instants, the exact date for old ones. */
const whenOf = (format: GovFormat, iso: string): string => {
    const at = new Date(iso)
    const age = Math.abs(Date.now() - at.getTime())
    if (age < 7 * 86_400_000) return format.relativeTime(at, new Date())
    return format.dateTime(at, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

const exactOf = (format: GovFormat, iso: string): string =>
    format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

/** The department tiles of the summary. */
export const departmentsOf = (
    t: GovTranslator,
    g: GovTranslator,
    format: GovFormat,
    governance: Governance,
): ReadonlyArray<GovDepartment> =>
    governance.departments.map((department) => {
        const name = g(`dept_${department.department}`)
        return {
            id: department.department,
            name,
            done: t("deptDone", { n: department.done7d }),
            waiting: t("deptWaiting", { n: department.waiting }),
            hasWaiting: department.waiting > 0,
            last:
                department.lastActivityAt === null
                    ? t("deptNoActivity")
                    : t("deptLast", { time: whenOf(format, department.lastActivityAt) }),
            label: `${name}: ${t("deptWaiting", { n: department.waiting })}`,
        }
    })

/** The waiting items shown on the overview: the oldest few. */
export const waitingItemsOf = (g: GovTranslator, waiting: ReadonlyArray<WaitingWork>): ReadonlyArray<GovWaitingItem> =>
    waiting.slice(0, TOP_WAITING).map((item) => {
        const action = g(`action_${item.action}`)
        const leadName = item.leadName ? ` · ${item.leadName}` : ""
        return {
            id: item.id,
            title: `${action}${leadName}`,
            department: g(`dept_${item.department}`),
            reason: item.reason ? g(`reason_${item.reason}`) : null,
            summary: item.summary || null,
        }
    })

/** The exception counts as chips, in the order the owner reads them. */
export const exceptionChipsOf = (
    t: GovTranslator,
    g: GovTranslator,
    governance: Governance,
): ReadonlyArray<GovExceptionChip> => {
    const chips: Array<GovExceptionChip> = EXCEPTION_ORDER.filter((key) => governance.exceptions[key] > 0).map(
        (key) => {
            const reason = g(`reason_${key}`)
            return { id: key, label: `${reason} · ${governance.exceptions[key]}`, tone: "warning" }
        },
    )
    if (governance.exceptions.failed > 0) {
        chips.push({
            id: "failed",
            label: `${t("exceptionsFailed")} · ${governance.exceptions.failed}`,
            tone: "danger",
        })
    }
    return chips
}

/** The total of all exceptions. */
export const exceptionTotalOf = (governance: Governance): number =>
    EXCEPTION_ORDER.reduce((sum, key) => sum + governance.exceptions[key], 0) + governance.exceptions.failed

/** The latest decisions of the history. */
export const historyRowsOf = (
    g: GovTranslator,
    format: GovFormat,
    governance: Governance,
): ReadonlyArray<GovHistoryRow> =>
    governance.recentDecisions.slice(0, TOP_HISTORY).map((row) => {
        const department = g(`dept_${row.department}`)
        const leadName = row.leadName ? ` · ${row.leadName}` : ""
        return {
            id: row.id,
            action: g(`action_${row.action}`),
            outcome: g(`outcome_${row.outcome}`),
            outcomeTone: OUTCOME_TONES[row.outcome] ?? "danger",
            when: whenOf(format, row.createdAt),
            exact: exactOf(format, row.createdAt),
            detail: `${department} · ${row.deciderKind === "policy" ? g("decider_policy") : row.decidedBy}${leadName}`,
        }
    })
