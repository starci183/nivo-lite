import { csvTextOf, type CsvCell } from "./csv"
import type { OverviewData, OverviewTools } from "./view"

/** One row of the report. */
type CsvRow = ReadonlyArray<CsvCell>

const BLANK: CsvRow = []

/** The core figures, one row each: this period and, for the four counted over a period, the one before. */
const kpiRows = (data: OverviewData, tools: OverviewTools): ReadonlyArray<CsvRow> => {
    const { t } = tools
    return [
        [t("kpisLabel"), t("exportThisPeriod"), t("exportPreviousPeriod")],
        [t("kpiConversations"), data.conversations?.current ?? "", data.conversations?.previous ?? ""],
        [t("kpiNewContacts"), data.newContacts?.current ?? "", data.newContacts?.previous ?? ""],
        [t("kpiRunsDone"), data.runsDone?.current ?? "", data.runsDone?.previous ?? ""],
        [t("kpiRunsFailed"), data.runsFailed?.current ?? "", data.runsFailed?.previous ?? ""],
        [t("kpiWaiting"), data.approvals.total, ""],
        [t("savingsCredits"), data.savings.creditsUsed, ""],
        [t("kpiMinutes"), data.savings.minutesSaved, ""],
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
        ...agentRows(data, tools),
    ])
