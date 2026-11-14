import type { useFormatter, useTranslations } from "next-intl"
import type { WorkspaceDashboardQuery } from "@/modules/api"
import { actionWordOf } from "@/modules/authority"
import type {
    OverviewAgentView,
    OverviewApprovalView,
    OverviewKpiView,
    OverviewSavingsView,
    OverviewView,
} from "@/modules/types"
import { maskPhones } from "@/modules/utils"
import { changeOfNumber, type Change } from "./change"
import type { OverviewPeriod } from "./period"

/** A figure of the period and the period before it. */
interface ComparedFigure {
    readonly current: number
    readonly previous: number
}

/** The core figures the engine counts; optional until `codegen` reads the regenerated schema, where the read types them as required. */
interface CoreFigures {
    readonly conversations?: ComparedFigure
    readonly newContacts?: ComparedFigure
    readonly runsDone?: ComparedFigure
    readonly runsFailed?: ComparedFigure
}

/** The generated read without the fields the back end dropped. */
type DashboardRead = WorkspaceDashboardQuery["workspaceDashboard"]

/** What the overview read answers. */
export type OverviewData = Omit<
    DashboardRead,
    "revenue" | "orders" | "newCustomers" | "closeRate" | "agentAutoRate" | "days" | "funnel" | "channels" | "savings"
> &
    CoreFigures & { readonly savings: Omit<DashboardRead["savings"], "ordersCreated" | "paymentsMatched"> }

/** The words and the number and date writer the view is made with. */
export interface OverviewTools {
    readonly t: ReturnType<typeof useTranslations<"overview">>
    readonly g: ReturnType<typeof useTranslations<"governance">>
    readonly format: ReturnType<typeof useFormatter>
    readonly now: Date
}

/** The most items the hours-saved definition names before it says "any other task". */
const DEFINITION_LINES_MAX = 4

/** The least a share of customers shows as a bar: none at zero, a sliver above. */
const SECONDS_PER_MINUTE = 60

const percentOf = (tools: OverviewTools, share: number): string =>
    tools.format.number(share, { style: "percent", maximumFractionDigits: 0 })

/** Which period a change is told against. */
const versusOf = (tools: OverviewTools, period: OverviewPeriod): string => {
    if (period === "today") return tools.t("versusToday")
    if (period === "last_7_days") return tools.t("versus7")
    return period === "last_30_days" ? tools.t("versus30") : tools.t("versusMonth")
}

/** A change in words: the arrow and its amount, or that nothing moved or there was nothing earlier to compare with. */
const changeWord = (tools: OverviewTools, change: Change): string => {
    if (change.kind === "same") return tools.t("deltaSame")
    const n = tools.format.number(change.amount)
    return change.kind === "up" ? tools.t("deltaUpCount", { n }) : tools.t("deltaDownCount", { n })
}

const rateText = (tools: OverviewTools, rate: number | null): string =>
    rate === null ? tools.t("none") : percentOf(tools, rate)

/** The core figures: four counted against the period before, and three read as they stand (stops waiting, credits used, minutes saved). */
const kpisOf = (data: OverviewData, tools: OverviewTools, period: OverviewPeriod): ReadonlyArray<OverviewKpiView> => {
    const { t } = tools
    const versus = versusOf(tools, period)
    const compared = (id: string, term: string, figure: ComparedFigure | undefined): OverviewKpiView =>
        figure === undefined
            ? { id, term, value: t("none") }
            : {
                  id,
                  term,
                  value: tools.format.number(figure.current),
                  meta: `${changeWord(tools, changeOfNumber(figure.current, figure.previous))} ${versus}`,
              }
    return [
        compared("conversations", t("kpiConversations"), data.conversations),
        compared("newContacts", t("kpiNewContacts"), data.newContacts),
        compared("runsDone", t("kpiRunsDone"), data.runsDone),
        compared("runsFailed", t("kpiRunsFailed"), data.runsFailed),
        { id: "waiting", term: t("kpiWaiting"), value: tools.format.number(data.approvals.total) },
        { id: "credits", term: t("savingsCredits"), value: tools.format.number(data.savings.creditsUsed) },
        { id: "minutes", term: t("kpiMinutes"), value: tools.format.number(data.savings.minutesSaved) },
    ]
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
    approvals: approvalsOf(data, tools),
    savings: savingsOf(data, tools),
    agents: agentsOf(data, tools),
})
