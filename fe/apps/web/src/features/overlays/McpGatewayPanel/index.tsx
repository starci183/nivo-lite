"use client"

import { useTranslations } from "next-intl"
import { McpGatewayRegion } from "@/components/composites/McpGatewayRegion"
import type { BadgeTone } from "@starci/grammar/common"
import type { McpGatewayBadge, McpGatewayCard } from "@/components/composites/McpGatewayRegion"
import { useQueryMcpCallLogSwr } from "@/hooks/swr/api/graphql/queries/useQueryMcpCallLogSwr"
import { useQueryMcpConnectorsSwr } from "@/hooks/swr/api/graphql/queries/useQueryMcpConnectorsSwr"
import { useQueryMcpToolGrantsSwr } from "@/hooks/swr/api/graphql/queries/useQueryMcpToolGrantsSwr"

/** How many audit lines the Connections page shows. */
const LOG_LIMIT = 20

type Tones = ReadonlyMap<string, BadgeTone>

const STATUS_TONE: Tones = new Map([
    ["active", "success"],
    ["degraded", "warning"],
])
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
 * The MCP gateway on the Connections page (owner | manager): the connectors behind the workspace's one MCP endpoint with their
 * namespaced tools, each agent's grants (default deny) and the latest audited calls with secrets masked.
 */
export const McpGatewayPanel = () => {
    const t = useTranslations("mcpGateway")
    const connectors = useQueryMcpConnectorsSwr()
    const grants = useQueryMcpToolGrantsSwr()
    const log = useQueryMcpCallLogSwr(LOG_LIMIT)
    const cards: ReadonlyArray<McpGatewayCard> = [
        {
            label: t("connectors"),
            emptyMessage: t("connectorsEmpty"),
            emptyDescription: t("connectorsEmptyHint"),
            rows: (connectors.data ?? []).map((connector) => ({
                id: connector.key,
                title: connector.name,
                description: `${connector.key}.* · ${connector.tools.map((tool) => tool.name.slice(connector.key.length + 1)).join(", ")}`,
                badges: [
                    { label: connector.status, tone: toneOf(STATUS_TONE, connector.status) },
                    { label: connector.kind === "native" ? t("native") : t("remote"), tone: "accent" },
                    plain(t("tools", { count: connector.tools.length, version: connector.contractVersion })),
                ],
            })),
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
                        : [plain(t("limitVnd", { amount: grant.limitVnd.toLocaleString("vi-VN") }))]),
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
                description: `${new Date(line.at).toLocaleString("vi-VN")} · ${line.argsMasked}${line.approvedBy === null ? "" : ` · ${t("approvedBy", { name: line.approvedBy })}`}`,
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
