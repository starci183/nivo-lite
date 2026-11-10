import type { FilterExpr } from "@nivo-lite/agent-sdk/query"

/** The periods the dashboard switches between; each reads the same data over a different window. */
export type DashboardPeriod = "today" | "last_7_days" | "last_30_days" | "this_month"

/** One day of the chart, in Vietnam time. */
export interface DashboardDay {
    /** The day, YYYY-MM-DD. */
    readonly day: string
    /** The first instant of the day. */
    readonly from: Date
    /** The first instant after the day. */
    readonly to: Date
}

/** The window of a period: the period, the one before it of the same length, and the days the chart draws. */
export interface DashboardWindow {
    /** The period asked. */
    readonly period: DashboardPeriod
    /** The first instant of the period. */
    readonly from: Date
    /** The first instant after the period (the start of tomorrow, Vietnam time). */
    readonly to: Date
    /** The first instant of the period before it, of the same length. */
    readonly previousFrom: Date
    /** The days of the chart: the period, and at least the last seven days. */
    readonly days: ReadonlyArray<DashboardDay>
}

/** A figure in the period and in the period before it. */
export interface Compared {
    /** In the period. */
    readonly current: number
    /** In the period before. */
    readonly previous: number
}

/** A share between zero and one in the period and in the period before it; null while there is nothing to divide by. */
export interface Rate {
    /** In the period. */
    readonly current: number | null
    /** In the period before. */
    readonly previous: number | null
}

/** The sales funnel of the period. */
export interface Funnel {
    /** Leads created. */
    readonly visitors: number
    /** Leads taken beyond the first stage. */
    readonly consulted: number
    /** Orders placed. */
    readonly ordered: number
    /** Orders placed that are paid. */
    readonly paid: number
}

/** The items that wait for the owner: how many wait in all and the oldest few. */
export interface ApprovalList {
    /** Every item that waits. */
    readonly total: number
    /** The oldest items. */
    readonly items: ReadonlyArray<ApprovalRow>
}

/** What one per-day statement measures: a sum of a field or a count, over the records its base filters keep. */
export interface PerDayFigure {
    /** Sum a field, or count. */
    readonly kind: "sum" | "count"
    /** The field summed; none for a count. */
    readonly field?: string
    /** The conditions every record of the figure meets. */
    readonly base: ReadonlyArray<FilterExpr>
}

/** One channel customers came through. */
export interface ChannelFacts {
    /** The channel key of the lead (telegram, zalo, facebook, instagram, website). */
    readonly channel: string
    /** Leads created in the period. */
    readonly leads: number
    /** What the paid orders of those channels' leads came to in the period, VND. */
    readonly revenueVnd: number
}

/** One day of the chart. */
export interface DayFacts {
    /** The day, YYYY-MM-DD, Vietnam time. */
    readonly day: string
    /** Matched payments received that day, VND. */
    readonly revenueVnd: number
    /** Orders placed that day. */
    readonly orders: number
}

/** What the records (the entity engine) say about the period. */
export interface RecordsFacts {
    /** Matched credits (SePay and the other bank feeds), VND. */
    readonly revenueVnd: Compared
    /** Matched credits received in the period. */
    readonly matchedPayments: number
    /** Orders placed: confirmed, invoiced or paid. */
    readonly ordersPlaced: Compared
    /** Orders placed that are paid. */
    readonly ordersPaid: Compared
    /** Leads created. */
    readonly leads: Compared
    /** Leads created that were taken beyond the first stage. */
    readonly leadsConsulted: Compared
    /** Leads and revenue per channel, the most leads first. */
    readonly channels: ReadonlyArray<ChannelFacts>
    /** The chart days, oldest first. */
    readonly days: ReadonlyArray<DayFacts>
    /** Replies an agent posted to customers. */
    readonly messagesAnswered: number
    /** Runs that failed or were handed to a person, by agent id. */
    readonly failedRunsByAgent: ReadonlyMap<string, number>
}

/** One finished action with its minutes: a line of the hours-saved definition shown on hover. */
export interface SavingLine {
    /** The action key. */
    readonly action: string
    /** How many were finished in the period. */
    readonly count: number
    /** Minutes one is worth. */
    readonly minutesEach: number
}

/** One installed agent's row of the performance table. */
export interface AgentRow {
    /** The agent. */
    readonly agentId: string
    /** The display name. */
    readonly name: string
    /** The @handle. */
    readonly handle: string
    /** The module the agent belongs to. */
    readonly module: string
    /** Items finished in the period. */
    readonly tasksDone: number
    /** Of those, finished by policy alone; null when none finished. */
    readonly autoRate: number | null
    /** Items that wait for the owner now. */
    readonly waiting: number
    /** Failed items and failed runs in the period. */
    readonly errors: number
    /** The middle time to finish an item by policy alone, seconds; null when none. */
    readonly medianResponseSeconds: number | null
    /** Minutes saved in the period. */
    readonly minutesSaved: number
    /** Credits spent in the period. */
    readonly credits: number
}

/** One item that waits for the owner, ready to open. */
export interface ApprovalRow {
    /** The work item. */
    readonly id: string
    /** The agent that raised it, or null when it has none. */
    readonly agentName: string | null
    /** The action key. */
    readonly action: string
    /** The one-line summary, or null. */
    readonly summary: string | null
    /** The customer, or null. */
    readonly customer: string | null
    /** When it was raised, ISO 8601. */
    readonly createdAt: string
    /** The workbench path that opens it, inside the workspace. */
    readonly href: string
}

/** What the agents did for the owner in the period. */
export interface SavingsFacts {
    /** Minutes saved, by the table of `saved-minutes.policy`. */
    readonly minutesSaved: number
    /** The lines of that sum, the largest first. */
    readonly lines: ReadonlyArray<SavingLine>
    /** Minutes an action not in the table is worth. */
    readonly defaultMinutes: number
    /** Replies an agent posted to customers. */
    readonly messagesAnswered: number
    /** Orders placed. */
    readonly ordersCreated: number
    /** Matched payments. */
    readonly paymentsMatched: number
    /** Credits used this month. */
    readonly creditsUsed: number
    /** The credits of the month, with the carry-over; null is unlimited. */
    readonly creditsLimit: number | null
}

/** Every figure of the workspace dashboard. */
export interface WorkspaceDashboardData {
    /** The window read. */
    readonly window: DashboardWindow
    /** Revenue, VND. */
    readonly revenue: Compared
    /** Orders placed. */
    readonly orders: Compared
    /** Leads created. */
    readonly newCustomers: Compared
    /** Paid orders over leads, 0..1; null while there are no leads. */
    readonly closeRate: Rate
    /** Items finished by policy alone over items finished, 0..1; null while none finished. */
    readonly agentAutoRate: Rate
    /** The chart days. */
    readonly days: ReadonlyArray<DayFacts>
    /** The funnel: leads, consulted, ordered, paid. */
    readonly funnel: Funnel
    /** Leads and revenue per channel. */
    readonly channels: ReadonlyArray<ChannelFacts>
    /** The items that wait for the owner. */
    readonly approvals: ApprovalList
    /** What the agents did. */
    readonly savings: SavingsFacts
    /** The installed agents. */
    readonly agents: ReadonlyArray<AgentRow>
}
