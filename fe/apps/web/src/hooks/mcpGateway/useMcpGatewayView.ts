"use client"

import { useQueryMcpCallLogSwr, useQueryMcpConnectorsSwr, useQueryMcpToolGrantsSwr } from "@/hooks/swr"
import { useFormatter, useTranslations } from "next-intl"
import { connectorRowsOf } from "./mcpGateway.shared"
import type { McpBadgeView, McpFormatter, McpTone, McpToolRowView, McpTranslator } from "./mcpGateway.shared"
import { useMcpConnectorCommands } from "./useMcpConnectorCommands"
import { useMcpConnectorForms } from "./useMcpConnectorForms"

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

/** A neutral badge. */
const plain = (label: string): McpBadgeView => ({ label, tone: "neutral" })

/** Each agent's grants of gateway tools: the mode, the data constraints and the money limit. */
const grantRowsOf = (
    t: McpTranslator,
    format: McpFormatter,
    grants: ReadonlyArray<McpGrantType>,
): ReadonlyArray<McpToolRowView> =>
    grants.map((grant) => ({
        id: `${grant.agentId}:${grant.tool}`,
        title: grant.tool,
        description: grant.agentName,
        badges: [
            { label: grant.mode, tone: MODE_TONE.get(grant.mode) ?? "neutral" },
            ...(grant.constraintsJson === "[]" ? [] : [plain(grant.constraintsJson)]),
            ...(grant.limitVnd === null ? [] : [plain(t("limitVnd", { amount: format.number(grant.limitVnd) }))]),
        ],
    }))

/** The latest audited calls: when, the masked arguments, who approved, the outcome and how long it took. */
const logRowsOf = (
    t: McpTranslator,
    format: McpFormatter,
    lines: ReadonlyArray<McpCallType>,
): ReadonlyArray<McpToolRowView> =>
    lines.map((line) => ({
        id: line.id,
        title: `${line.tool} · ${line.agentName}`,
        description: [
            format.dateTime(new Date(line.at), { dateStyle: "short", timeStyle: "medium" }),
            line.argsMasked,
            line.approvedBy === null ? "" : t("approvedBy", { name: line.approvedBy }),
        ]
            .filter(Boolean)
            .join(" · "),
        badges: [
            {
                label: line.errorCode === null ? line.outcome : `${line.outcome}: ${line.errorCode}`,
                tone: OUTCOME_TONE.get(line.outcome) ?? "danger",
            },
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
    const connectors = useQueryMcpConnectorsSwr(enabled)
    const grants = useQueryMcpToolGrantsSwr(enabled)
    const log = useQueryMcpCallLogSwr(LOG_LIMIT, enabled)
    const reload = () => connectors.mutate()
    const commands = useMcpConnectorCommands(reload)
    const forms = useMcpConnectorForms(reload, connectors.data ?? [])
    return {
        /** The region is drawn for a manager once the page is ready, and only then is anything read. */
        isShown: enabled,
        label: t("label"),
        isLoading: connectors.isLoading || grants.isLoading || log.isLoading,
        isFailed: connectors.error !== undefined || grants.error !== undefined || log.error !== undefined,
        view: {
            cards: [
                {
                    label: t("connectors"),
                    emptyMessage: t("connectorsEmpty"),
                    emptyDescription: t("connectorsEmptyHint"),
                    rows: connectorRowsOf(t, format, connectors.data ?? [], commands, forms.openCredential),
                },
                {
                    label: t("grants"),
                    emptyMessage: t("grantsEmpty"),
                    emptyDescription: t("grantsEmptyHint"),
                    rows: grantRowsOf(t, format, grants.data ?? []),
                },
                {
                    label: t("log"),
                    emptyMessage: t("logEmpty"),
                    emptyDescription: t("logEmptyHint"),
                    rows: logRowsOf(t, format, log.data ?? []),
                },
            ],
        },
        forms: forms.view,
        on: forms.on,
        failure: { title: t("failedTitle"), description: t("failedBody"), retryLabel: t("retry") },
        onRetry: () => {
            void connectors.mutate()
            void grants.mutate()
            void log.mutate()
        },
    }
}
