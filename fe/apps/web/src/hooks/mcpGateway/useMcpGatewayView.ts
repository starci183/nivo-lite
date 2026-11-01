"use client"

import {
    useQueryConnectionAgentsSwr,
    useQueryMcpCallLogSwr,
    useQueryMcpConnectorsSwr,
    useQueryMcpToolGrantsSwr,
} from "@/hooks/swr"
import { useFormatter, useTranslations } from "next-intl"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { connectorRowsOf } from "./mcpGateway.shared"
import type { McpBadgeView, McpFormatter, McpTone, McpToolRowView } from "./mcpGateway.shared"
import { modeWordOf, outcomeWordOf, toolNameOf } from "@/modules/mcpGateway/mcpGateway.words"
import type { McpTranslator } from "@/modules/mcpGateway/mcpGateway.words"
import { useMcpConnectorCommands } from "./useMcpConnectorCommands"
import { useMcpConnectorForms } from "./useMcpConnectorForms"
import { grantKeyOf, useMcpGrantCommands } from "@/hooks/mcpGrants"
import type { McpToolAgentsOf } from "@/hooks/mcpGrants"

/** How many audit lines the Connections page shows. */
const LOG_LIMIT = 20

/** One agent's grant of a gateway tool, as the `mcpToolGrants` read answers it. */
type McpGrantType = NonNullable<ReturnType<typeof useQueryMcpToolGrantsSwr>["data"]>[number]
/** One audited gateway call, as the `mcpCallLog` read answers it. */
type McpCallType = NonNullable<ReturnType<typeof useQueryMcpCallLogSwr>["data"]>[number]

const MODE_TONE: ReadonlyMap<string, McpTone> = new Map([
    ["auto", "success"],
    ["ask", "warning"],
])
const OUTCOME_TONE: ReadonlyMap<string, McpTone> = new Map([
    ["ok", "success"],
    ["approval", "warning"],
])

/** The words a connector's server gave a tool id; blank for a tool no connector lists. */
type ToolDescriber = (tool: string) => string

/** The first read error of the three, typed as unknown as SWR types it `any`. */
const firstError = (...errors: ReadonlyArray<unknown>): unknown => errors.find((error) => error !== undefined)

/** A neutral badge. */
const plain = (label: string): McpBadgeView => ({ label, tone: "neutral" })

/** Each agent's grants of gateway tools: the mode, whether data constraints apply, and the money limit. */
const grantRowsOf = (
    t: McpTranslator,
    format: McpFormatter,
    grants: ReadonlyArray<McpGrantType>,
    describe: ToolDescriber,
): ReadonlyArray<McpToolRowView> =>
    grants.map((grant) => ({
        id: `${grant.agentId}:${grant.tool}`,
        title: toolNameOf(t, grant.tool, describe(grant.tool)),
        description: grant.agentName,
        badges: [
            { label: modeWordOf(t, grant.mode), tone: MODE_TONE.get(grant.mode) ?? "neutral" },
            ...(grant.constraintsJson === "[]" ? [] : [plain(t("constrained"))]),
            ...(grant.limitVnd === null ? [] : [plain(t("limitVnd", { amount: format.number(grant.limitVnd) }))]),
        ],
    }))

/** The latest audited calls: when, who approved, the outcome and how long it took. The arguments stay in the audit record. */
const logRowsOf = (
    t: McpTranslator,
    format: McpFormatter,
    lines: ReadonlyArray<McpCallType>,
    describe: ToolDescriber,
): ReadonlyArray<McpToolRowView> =>
    lines.map((line) => ({
        id: line.id,
        title: `${toolNameOf(t, line.tool, describe(line.tool))} · ${line.agentName}`,
        description: [
            format.dateTime(new Date(line.at), { dateStyle: "short", timeStyle: "medium" }),
            line.approvedBy === null ? "" : t("approvedBy", { name: line.approvedBy }),
        ]
            .filter(Boolean)
            .join(" · "),
        badges: [
            { label: outcomeWordOf(t, line.outcome), tone: OUTCOME_TONE.get(line.outcome) ?? "danger" },
            plain(t("duration", { ms: line.durationMs })),
        ],
    }))

/**
 * The MCP gateway region of the Connections page (owner | manager; nothing is read while `enabled` is false): the connectors behind
 * the workspace's one MCP endpoint with their pinned tools, approval, credential state and Set / Rotate credential, Test, Approve
 * and Check; the form that registers a remote connector (endpoint and credential, entered once); each agent's grants (default deny)
 * and the latest audited calls with secrets masked.
 */
export const useMcpGatewayView = (enabled: boolean) => {
    const t = useTranslations("mcpGateway")
    const format = useFormatter()
    const slotLabelsOf = useSlotLabels()
    const connectors = useQueryMcpConnectorsSwr(enabled)
    const grants = useQueryMcpToolGrantsSwr(enabled)
    const log = useQueryMcpCallLogSwr(LOG_LIMIT, enabled)
    const agents = useQueryConnectionAgentsSwr()
    const reload = () => connectors.mutate()
    const commands = useMcpConnectorCommands(reload)
    const grantCommands = useMcpGrantCommands(grants.data ?? [], () => grants.mutate())
    const forms = useMcpConnectorForms(reload, connectors.data ?? [])
    const held = new Map((grants.data ?? []).map((grant) => [grantKeyOf(grant.agentId, grant.tool), grant.mode]))
    const described = new Map(
        (connectors.data ?? []).flatMap((one) => one.tools.map((tool) => [tool.name, tool.description])),
    )
    const describe: ToolDescriber = (tool) => described.get(tool) ?? ""
    /** Every active agent gets a switch on every tool; on means a grant exists that is not `never`. */
    const agentsOf: McpToolAgentsOf = (tool) => ({
        label: t("toolAgents", { tool: toolNameOf(t, tool, describe(tool)) }),
        switchLabel: t("grantSwitch"),
        rows: (agents.data ?? [])
            .filter((agent) => agent.status === "active")
            .map((agent) => ({
                id: `${agent.id}:${tool}`,
                name: agent.name,
                isOn: held.has(grantKeyOf(agent.id, tool)) && held.get(grantKeyOf(agent.id, tool)) !== "never",
                isDisabled: grantCommands.busyKey !== null,
                onToggle: (isOn: boolean) => void grantCommands.toggle(agent.id, tool, isOn),
            })),
    })
    const cards = {
        cards: [
            {
                label: t("connectors"),
                emptyMessage: t("connectorsEmpty"),
                emptyDescription: t("connectorsEmptyHint"),
                rows: connectorRowsOf(t, format, connectors.data ?? [], commands, forms.openCredential, agentsOf),
            },
            {
                label: t("grants"),
                emptyMessage: t("grantsEmpty"),
                emptyDescription: t("grantsEmptyHint"),
                rows: grantRowsOf(t, format, grants.data ?? [], describe),
            },
            {
                label: t("log"),
                emptyMessage: t("logEmpty"),
                emptyDescription: t("logEmptyHint"),
                rows: logRowsOf(t, format, log.data ?? [], describe),
            },
        ],
    }
    const reads = {
        data: connectors.data === undefined || grants.data === undefined || log.data === undefined ? undefined : cards,
        error: firstError(connectors.error, grants.error, log.error),
        isLoading: connectors.isLoading || grants.isLoading || log.isLoading,
    }
    return {
        /** The region is drawn for a manager once the page is ready, and only then is anything read. */
        isShown: enabled,
        label: t("label"),
        slot: slotOfSwr(reads),
        labels: { ...slotLabelsOf(t("connectorsEmpty")), error: t("failedTitle"), retry: t("retry") },
        forms: forms.view,
        on: forms.on,
        onRetry: () => {
            void connectors.mutate()
            void grants.mutate()
            void log.mutate()
        },
    }
}
