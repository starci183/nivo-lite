import type { BoundConnection } from "@modules/domain/agent-connections"
import type {
    DashboardAgent,
    OptionalId,
    ConnectionItem,
    DashboardItem,
    KnowledgeData,
    LensCounts,
    OpenGaps,
} from "./agents.contracts"
import type { OptionalInstallation } from "./agents.port"
import type { DashboardItemRow } from "./persistence/dashboard.rows"

/** Work items whose lead, summary or customer carries this text are test runs and never counted. */
export const TEST_RUN_PATTERN = "UAT|DBG"

/** How many lines a dashboard list shows. */
export const LIST_LIMIT = 5

/** How many open gaps the knowledge region shows. */
export const GAP_LIMIT = 3

const GAP_QUESTION_MAX = 120
const SUMMARY_MAX = 140

/** Collapses white space and cuts the text to `max` characters with an ellipsis. */
export const clip = (text: string, max: number): string => {
    const flat = text.replace(/\s+/gu, " ").trim()
    return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

/** The workbench link that opens the decision for one work item. */
export const decisionHrefOf = (module: string, installationId: string | null, workItemId: string): string => {
    const base = installationId === null ? `/agents/${module}` : `/agents/${module}/${installationId}`
    return `${base}/workbench?focus=${workItemId}`
}

/** One work item row as a dashboard line. */
export const itemOf = (row: DashboardItemRow, decisionHref: string): DashboardItem => ({
    id: row.id,
    title: clip(row.summary ?? "", SUMMARY_MAX),
    action: row.action,
    customer: row.customer ?? "",
    at: row.at,
    leadId: row.lead_id,
    resultHref: row.result_href === "" ? null : row.result_href,
    decisionHref,
})

/** The count of rows before the limit; every row of a page carries it. */
export const totalOf = (rows: ReadonlyArray<DashboardItemRow>): number => Number(rows[0]?.total ?? 0)

const statusOf = (status: string): ConnectionItem["status"] => {
    if (status === "connected") return "connected"
    return status === "error" ? "error" : "pending"
}

/** The connections bound to the agent, each once, as dashboard lines. */
export const connectionItemsOf = (bound: ReadonlyArray<BoundConnection>): ReadonlyArray<ConnectionItem> => {
    const seen = new Set<string>()
    return bound.flatMap((connection) => {
        if (seen.has(connection.id)) return []
        seen.add(connection.id)
        return [
            {
                id: connection.id,
                name: connection.name,
                provider: connection.provider,
                botUsername: connection.botUsername,
                accountMasked: connection.accountMasked,
                status: statusOf(connection.status),
                access: connection.access,
                purpose: connection.purpose,
            },
        ]
    })
}

/** The knowledge region: the lens counts and the gaps with their questions clipped. */
export const knowledgeOf = (counts: LensCounts, gaps: OpenGaps | null): KnowledgeData => ({
    ...counts,
    gaps:
        gaps === null
            ? null
            : {
                  openCount: gaps.openCount,
                  items: gaps.items.map((gap) => ({ ...gap, question: clip(gap.question, GAP_QUESTION_MAX) })),
              },
})

/** The agent row id of an installation, or null when it has none yet. */
export const agentIdOf = (installation: OptionalInstallation): OptionalId => installation?.agentId ?? null

/** The installed agent of the dashboard, or null when the module has none yet. */
export const agentOf = (installation: OptionalInstallation): DashboardAgent | null =>
    installation?.agentId === undefined || installation.agentId === null
        ? null
        : { id: installation.agentId, name: installation.name, mode: installation.operatingMode }
