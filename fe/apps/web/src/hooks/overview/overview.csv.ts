import { csvTextOf } from "@/modules/overview"
import type { CsvCell } from "@/modules/overview"
import type { OverviewData, OverviewTools } from "./overview.view"

/** One row of the report. */
type CsvRow = ReadonlyArray<CsvCell>

const BLANK: CsvRow = []

/** The key figures, one row each: this period and the one before. */
const kpiRows = (data: OverviewData, tools: OverviewTools): ReadonlyArray<CsvRow> => {
    const { t } = tools
    return [
        [t("kpisLabel"), t("exportThisPeriod"), t("exportPreviousPeriod")],
        [t("kpiRevenue"), data.revenue.current, data.revenue.previous],
        [t("kpiOrders"), data.orders.current, data.orders.previous],
        [t("kpiCustomers"), data.newCustomers.current, data.newCustomers.previous],
        [t("kpiClose"), data.closeRate.current ?? "", data.closeRate.previous ?? ""],
        [t("kpiAuto"), data.agentAutoRate.current ?? "", data.agentAutoRate.previous ?? ""],
    ]
}

/** The days, the funnel and the channels. */
const salesRows = (data: OverviewData, tools: OverviewTools): ReadonlyArray<CsvRow> => {
    const { t } = tools
    return [
        [t("chartTitle"), t("chartRevenue"), t("chartOrders")],
        ...data.days.map((day): CsvRow => [day.day, day.revenueVnd, day.orders]),
        BLANK,
        [t("funnelTitle"), ""],
        [t("funnelVisitors"), data.funnel.visitors],
        [t("funnelConsulted"), data.funnel.consulted],
        [t("funnelOrdered"), data.funnel.ordered],
        [t("funnelPaid"), data.funnel.paid],
        BLANK,
        [t("channelsColumnChannel"), t("channelsColumnCustomers"), t("channelsColumnRevenue")],
        ...data.channels.map((channel): CsvRow => [channel.channel, channel.leads, channel.revenueVnd]),
    ]
}

/** One row per agent. */
const agentRows = (data: OverviewData, tools: OverviewTools): ReadonlyArray<CsvRow> => {
    const { t } = tools
    return [
        [
            t("agentsColumnAgent"),
            t("agentsColumnTasks"),
            t("agentsColumnAuto"),
            t("agentsColumnWaiting"),
            t("agentsColumnErrors"),
            t("agentsColumnResponse"),
            t("agentsColumnSaved"),
            t("agentsColumnCredits"),
        ],
        ...data.agents.map(
            (agent): CsvRow => [
                agent.name,
                agent.tasksDone,
                agent.autoRate ?? "",
                agent.waiting,
                agent.errors,
                agent.medianResponseSeconds ?? "",
                agent.minutesSaved,
                agent.credits,
            ],
        ),
    ]
}

/** The text of the report file: the same figures the page shows, as numbers a spreadsheet can add up, a blank row between the parts. */
export const overviewCsvOf = (data: OverviewData, tools: OverviewTools, range: string): string =>
    csvTextOf([
        [tools.t("title"), range],
        BLANK,
        ...kpiRows(data, tools),
        BLANK,
        ...salesRows(data, tools),
        BLANK,
        ...agentRows(data, tools),
    ])
