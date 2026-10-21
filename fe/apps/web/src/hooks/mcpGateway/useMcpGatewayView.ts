"use client"

import { useQueryMcpCallLogSwr, useQueryMcpConnectorsSwr, useQueryMcpToolGrantsSwr } from "@/hooks/swr"
import { useFormatter, useTranslations } from "next-intl"
import { connectorRowsOf, grantRowsOf, logRowsOf } from "./mcpGateway.shared"
import { useMcpConnectorCommands } from "./useMcpConnectorCommands"

/** How many audit lines the Connections page shows. */
const LOG_LIMIT = 20

/**
 * The MCP gateway region of the Connections page (owner | manager; nothing is read while `enabled` is false): the connectors behind
 * the workspace's one MCP endpoint with their pinned tools, approval and Approve / Check, each agent's grants (default deny) and the
 * latest audited calls with secrets masked.
 */
export const useMcpGatewayView = (enabled: boolean) => {
    const t = useTranslations("mcpGateway")
    const format = useFormatter()
    const connectors = useQueryMcpConnectorsSwr(enabled)
    const grants = useQueryMcpToolGrantsSwr(enabled)
    const log = useQueryMcpCallLogSwr(LOG_LIMIT, enabled)
    const commands = useMcpConnectorCommands(() => connectors.mutate())
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
                    rows: connectorRowsOf(t, format, connectors.data ?? [], commands),
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
        failure: { title: t("failedTitle"), description: t("failedBody"), retryLabel: t("retry") },
        onRetry: () => {
            void connectors.mutate()
            void grants.mutate()
            void log.mutate()
        },
    }
}
