import type { useFormatter, useTranslations } from "next-intl"
import type { WorkspaceDashboardQuery } from "@/modules/api"
import { actionWordOf } from "@/modules/authority"
import { changeOfNumber, changeOfRate, moneyPartsOf } from "@/modules/overview"
import type { Change, OverviewPeriod } from "@/modules/overview"
import type {
    OverviewAgentView,
    OverviewApprovalView,
    OverviewBarView,
    OverviewChannelView,
    OverviewFunnelStepView,
    OverviewKpiView,
    OverviewSavingsView,
    OverviewView,
} from "@/modules/types"
import { maskPhones } from "@/modules/utils"

/** What the overview read answers. */
export type OverviewData = WorkspaceDashboardQuery["workspaceDashboard"]

/** The words and the number and date writer the view is made with. */
export interface OverviewTools {
    readonly t: ReturnType<typeof useTranslations<"overview">>
    readonly g: ReturnType<typeof useTranslations<"governance">>
    readonly format: ReturnType<typeof useFormatter>
    readonly now: Date
}

/** The clock the business keeps: the days of the chart are days in Vietnam. */
const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The chart names its days by weekday up to a week, and by day of the month beyond. */
const WEEKDAY_BARS_MAX = 7

/** The most items the hours-saved definition names before it says "any other task". */
const DEFINITION_LINES_MAX = 4

/** The least a share of customers shows as a bar: none at zero, a sliver above. */
const SECONDS_PER_MINUTE = 60

/** A short sum: 750k, 3.1 million. */
const moneyOf = (tools: OverviewTools, vnd: number): string => {
    const parts = moneyPartsOf(vnd)
    const n = tools.format.number(parts.value, { maximumFractionDigits: 1 })
    if (parts.unit === "billion") return tools.t("moneyBillion", { n })
    if (parts.unit === "million") return tools.t("moneyMillion", { n })
    return parts.unit === "thousand" ? tools.t("moneyThousand", { n }) : n
}

/** The whole sum with the dong sign, as a table cell tells it: 2.000 ₫. */
const fullMoneyOf = (tools: OverviewTools, vnd: number): string =>
    tools.format.number(vnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 })

const percentOf = (tools: OverviewTools, share: number): string =>
    tools.format.number(share, { style: "percent", maximumFractionDigits: 0 })

/** Which period a change is told against. */
const versusOf = (tools: OverviewTools, period: OverviewPeriod): string => {
    if (period === "today") return tools.t("versusToday")
    if (period === "last_7_days") return tools.t("versus7")
    return period === "last_30_days" ? tools.t("versus30") : tools.t("versusMonth")
}

/** The thing a change counts. */
type ChangeUnit = "percent" | "orders" | "customers" | "points"

/** A change in words: the arrow and its amount, or that nothing moved or there was nothing earlier to compare with. */
const changeWord = (tools: OverviewTools, change: Change, unit: ChangeUnit): string => {
    if (change.kind === "none") return tools.t("deltaNone")
    if (change.kind === "same") return tools.t("deltaSame")
    const n = tools.format.number(change.amount)
    const up = change.kind === "up"
    if (unit === "percent") return up ? tools.t("deltaUpPercent", { n }) : tools.t("deltaDownPercent", { n })
    if (unit === "orders") return up ? tools.t("deltaUpOrders", { n }) : tools.t("deltaDownOrders", { n })
    if (unit === "customers") return up ? tools.t("deltaUpCustomers", { n }) : tools.t("deltaDownCustomers", { n })
    return up ? tools.t("deltaUpPoints", { n }) : tools.t("deltaDownPoints", { n })
}

const rateText = (tools: OverviewTools, rate: number | null): string =>
    rate === null ? tools.t("none") : percentOf(tools, rate)

/** The five key figures. */
const kpisOf = (data: OverviewData, tools: OverviewTools, period: OverviewPeriod): ReadonlyArray<OverviewKpiView> => {
    const { t } = tools
    const versus = versusOf(tools, period)
    const meta = (change: Change, unit: ChangeUnit): string => `${changeWord(tools, change, unit)} ${versus}`
    return [
        {
            id: "revenue",
            term: t("kpiRevenue"),
            value: moneyOf(tools, data.revenue.current),
            meta: meta(changeOfNumber(data.revenue.current, data.revenue.previous, "percent"), "percent"),
        },
        {
            id: "orders",
            term: t("kpiOrders"),
            value: tools.format.number(data.orders.current),
            meta: meta(changeOfNumber(data.orders.current, data.orders.previous, "count"), "orders"),
        },
        {
            id: "customers",
            term: t("kpiCustomers"),
            value: tools.format.number(data.newCustomers.current),
            meta: meta(changeOfNumber(data.newCustomers.current, data.newCustomers.previous, "count"), "customers"),
        },
        {
            id: "close",
            term: t("kpiClose"),
            value: rateText(tools, data.closeRate.current),
            meta: meta(changeOfRate(data.closeRate.current, data.closeRate.previous), "points"),
        },
        {
            id: "auto",
            term: t("kpiAuto"),
            value: rateText(tools, data.agentAutoRate.current),
            meta: meta(changeOfRate(data.agentAutoRate.current, data.agentAutoRate.previous), "points"),
        },
    ]
}

/** The bars of the chart: one per day, named by weekday, or by day of the month when there are many. */
const barsOf = (
    data: OverviewData,
    tools: OverviewTools,
    valueOf: (day: OverviewData["days"][number]) => number,
    labelOf: (value: number) => string,
): ReadonlyArray<OverviewBarView> =>
    data.days.map((day) => {
        const noon = new Date(`${day.day}T05:00:00.000Z`)
        const label = tools.format.dateTime(
            noon,
            data.days.length <= WEEKDAY_BARS_MAX
                ? { weekday: "short", timeZone: BUSINESS_TIME_ZONE }
                : { day: "numeric", timeZone: BUSINESS_TIME_ZONE },
        )
        return { id: day.day, label, value: valueOf(day), valueLabel: labelOf(valueOf(day)) }
    })

/** The funnel: each step a count and its share of the customers that came in. */
const funnelOf = (data: OverviewData, tools: OverviewTools): ReadonlyArray<OverviewFunnelStepView> => {
    const { t } = tools
    const max = Math.max(1, data.funnel.visitors)
    const step = (id: string, label: string, count: number): OverviewFunnelStepView => ({
        id,
        label,
        value: count,
        max,
        valueLabel: t("funnelValue", { count: tools.format.number(count), share: percentOf(tools, count / max) }),
    })
    return [
        step("visitors", t("funnelVisitors"), data.funnel.visitors),
        step("consulted", t("funnelConsulted"), data.funnel.consulted),
        step("ordered", t("funnelOrdered"), data.funnel.ordered),
        step("paid", t("funnelPaid"), data.funnel.paid),
    ]
}

/** The channels with the customers and the money each brought; a bar says how many customers against the busiest channel. */
const channelsOf = (data: OverviewData, tools: OverviewTools): ReadonlyArray<OverviewChannelView> => {
    const busiest = Math.max(1, ...data.channels.map((channel) => channel.leads))
    return data.channels.map((channel) => ({
        id: channel.channel,
        label: tools.g.has(`channel_${channel.channel}`)
            ? tools.g(`channel_${channel.channel}`)
            : tools.t("channelOther"),
        leads: tools.format.number(channel.leads),
        revenue: fullMoneyOf(tools, channel.revenueVnd),
        share: Math.round((channel.leads / busiest) * 100),
    }))
}

/** What waits for the owner: a line each, its title the summary the agent wrote, its second line the agent and how long ago. */
const approvalsOf = (data: OverviewData, tools: OverviewTools): OverviewView["approvals"] => {
    const rows: ReadonlyArray<OverviewApprovalView> = data.approvals.items.map((item) => ({
        id: item.id,
        title: maskPhones(item.summary ?? actionWordOf(tools.g, item.action)),
        description: [item.agentName, tools.format.relativeTime(new Date(item.createdAt), tools.now)]
            .filter((part) => part !== null)
            .join(" · "),
        href: item.href,
    }))
    return {
        count: data.approvals.total > 0 ? data.approvals.total : null,
        items: rows,
        hasMore: data.approvals.total > rows.length,
    }
}

const hoursOf = (tools: OverviewTools, minutes: number): string =>
    tools.t("savingsHours", { hours: tools.format.number(minutes / SECONDS_PER_MINUTE, { maximumFractionDigits: 1 }) })

/** The hours saved, the table that makes them, and the other things the agents did. */
const savingsOf = (data: OverviewData, tools: OverviewTools): OverviewSavingsView => {
    const { t } = tools
    const { savings } = data
    const lines = [
        ...savings.lines.slice(0, DEFINITION_LINES_MAX).map((line) =>
            t("savingsDefinitionLine", {
                action: actionWordOf(tools.g, line.action),
                minutes: line.minutesEach,
                count: tools.format.number(line.count),
            }),
        ),
        t("savingsDefinitionDefault", { minutes: savings.defaultMinutes }),
    ]
    const used = tools.format.number(savings.creditsUsed)
    return {
        hours: hoursOf(tools, savings.minutesSaved),
        definition: t("savingsDefinition", { lines: lines.join(", ") }),
        facts: [
            { id: "messages", term: t("savingsMessages"), value: tools.format.number(savings.messagesAnswered) },
            { id: "orders", term: t("savingsOrders"), value: tools.format.number(savings.ordersCreated) },
            { id: "payments", term: t("savingsPayments"), value: tools.format.number(savings.paymentsMatched) },
            {
                id: "credits",
                term: t("savingsCredits"),
                value:
                    savings.creditsLimit === null
                        ? t("creditsUnlimited", { used })
                        : t("creditsValue", { used, limit: tools.format.number(savings.creditsLimit) }),
            },
        ],
    }
}

/** How long an agent took, in the middle: seconds up to a minute, minutes beyond; a dash when nothing was done. */
const responseOf = (tools: OverviewTools, seconds: number | null): string => {
    if (seconds === null) return tools.t("none")
    if (seconds < SECONDS_PER_MINUTE)
        return tools.t("seconds", { n: tools.format.number(Math.max(1, Math.round(seconds))) })
    return tools.t("minutes", { n: tools.format.number(Math.round(seconds / SECONDS_PER_MINUTE)) })
}

/** The table of agents. */
const agentsOf = (data: OverviewData, tools: OverviewTools): ReadonlyArray<OverviewAgentView> =>
    data.agents.map((agent) => ({
        id: agent.agentId,
        name: agent.name,
        handle: agent.handle,
        tasks: tools.format.number(agent.tasksDone),
        auto: rateText(tools, agent.autoRate),
        autoShare: agent.autoRate === null ? null : Math.round(agent.autoRate * 100),
        waiting: tools.format.number(agent.waiting),
        errors: tools.format.number(agent.errors),
        response: responseOf(tools, agent.medianResponseSeconds),
        saved: hoursOf(tools, agent.minutesSaved),
        credits: tools.format.number(agent.credits),
    }))

/** Every figure of the overview worded for the reader. */
export const overviewViewOf = (data: OverviewData, tools: OverviewTools, period: OverviewPeriod): OverviewView => ({
    kpis: kpisOf(data, tools, period),
    revenueBars: barsOf(
        data,
        tools,
        (day) => day.revenueVnd,
        (value) => moneyOf(tools, value),
    ),
    orderBars: barsOf(
        data,
        tools,
        (day) => day.orders,
        (value) => tools.format.number(value),
    ),
    funnel: funnelOf(data, tools),
    channels: channelsOf(data, tools),
    approvals: approvalsOf(data, tools),
    savings: savingsOf(data, tools),
    agents: agentsOf(data, tools),
})
