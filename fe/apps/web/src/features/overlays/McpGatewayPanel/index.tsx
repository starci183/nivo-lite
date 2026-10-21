"use client"

import { useFormatter, useTranslations } from "next-intl"
import { McpGatewayRegion } from "@/components/composites/McpGatewayRegion"
import type { BadgeTone } from "@starci/grammar/common"
import type { McpGatewayBadge, McpGatewayCard } from "@/components/composites/McpGatewayRegion"
import { connectorRowsOf, useMcpConnectorCommands } from "@/hooks/mcpGateway"
import { useQueryMcpCallLogSwr, useQueryMcpConnectorsSwr, useQueryMcpToolGrantsSwr } from "@/hooks/swr"

/** How many audit lines the Connections page shows. */
const LOG_LIMIT = 20

type Tones = ReadonlyMap<string, BadgeTone>

const MODE_TONE: Tones = new Map([
    ["auto", "success"],
    ["ask", "warning"],
])
const OUTCOME_TONE: Tones = new Map([
    ["ok", "success"],
    ["approval", "warning"],
])

const toneOf = (map: Tones, key: string, fallback: BadgeTone = "neutral"): BadgeTone => map.get(key) ?? fallback

/** A neutral badge. */
const plain = (label: string): McpGatewayBadge => ({ label, tone: "neutral" })

/**
 * The MCP gateway on the Connections page (owner | manager, the only readers who mount it): the connectors behind the workspace's
 * one MCP endpoint with their pinned tools, approval and Approve / Check, each agent's grants (default deny) and the latest audited
 * calls with secrets masked.
 */
export const McpGatewayPanel = () => {
    const t = useTranslations("mcpGateway")
    const format = useFormatter()
    const connectors = useQueryMcpConnectorsSwr()
    const grants = useQueryMcpToolGrantsSwr()
    const log = useQueryMcpCallLogSwr(LOG_LIMIT)
    const commands = useMcpConnectorCommands()
    const cards: ReadonlyArray<McpGatewayCard> = [
        {
            label: t("connectors"),
            emptyMessage: t("connectorsEmpty"),
            emptyDescription: t("connectorsEmptyHint"),
            rows: connectorRowsOf(t, format, connectors.data ?? [], commands),
        },
        {
            label: t("grants"),
            emptyMessage: t("grantsEmpty"),
            emptyDescription: t("grantsEmptyHint"),
            rows: (grants.data ?? []).map((grant) => ({
                id: `${grant.agentId}:${grant.tool}`,
                title: grant.tool,
                description: grant.agentName,
                badges: [
                    { label: grant.mode, tone: toneOf(MODE_TONE, grant.mode) },
                    ...(grant.constraintsJson === "[]" ? [] : [plain(grant.constraintsJson)]),
                    ...(grant.limitVnd === null
                        ? []
                        : [plain(t("limitVnd", { amount: format.number(grant.limitVnd) }))]),
                ],
            })),
        },
        {
            label: t("log"),
            emptyMessage: t("logEmpty"),
            emptyDescription: t("logEmptyHint"),
            rows: (log.data ?? []).map((line) => ({
                id: line.id,
                title: `${line.tool} · ${line.agentName}`,
                description: `${format.dateTime(new Date(line.at), { dateStyle: "short", timeStyle: "medium" })} · ${line.argsMasked}${line.approvedBy === null ? "" : ` · ${t("approvedBy", { name: line.approvedBy })}`}`,
                badges: [
                    {
                        label: line.errorCode === null ? line.outcome : `${line.outcome}: ${line.errorCode}`,
                        tone: toneOf(OUTCOME_TONE, line.outcome, "danger"),
                    },
                    plain(t("duration", { ms: line.durationMs })),
                ],
            })),
        },
    ]
    return (
        <McpGatewayRegion
            label={t("label")}
            isLoading={connectors.isLoading || grants.isLoading || log.isLoading}
            isFailed={connectors.error !== undefined || grants.error !== undefined || log.error !== undefined}
            view={{ cards }}
            failure={{ title: t("failedTitle"), description: t("failedBody"), retryLabel: t("retry") }}
            onRetry={() => {
                void connectors.mutate()
                void grants.mutate()
                void log.mutate()
            }}
        />
    )
}
