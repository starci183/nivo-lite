"use client"

import {
    useMutateApproveMcpConnectorSwr,
    useMutateCheckMcpConnectorSwr,
    useMutateSyncMcpConnectorSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"

/** The commands of the remote MCP connectors (owner | manager), and which connector is busy. */
export interface McpConnectorCommands {
    /** Approves the live tool catalog of a connector as it was read, then reloads the connectors. */
    readonly approve: (key: string) => Promise<void>
    /** Checks that a connector answers MCP, then reloads the connectors with the status and time it recorded. */
    readonly check: (key: string) => Promise<void>
    /** Tests the connection: reads the live tool list with the stored credential, then reloads the connectors. */
    readonly test: (key: string) => Promise<void>
    /** The connector a command is running for, or null. */
    readonly busyKey: string | null
}

/** Approve / Check / Test for the gateway connectors: each reports its outcome in a toast and then `reload`s the connector list. */
export const useMcpConnectorCommands = (reload: () => Promise<unknown>): McpConnectorCommands => {
    const t = useTranslations("mcpGateway")
    const runGraphQL = useGraphQLWithToast()
    const approveSwr = useMutateApproveMcpConnectorSwr()
    const checkSwr = useMutateCheckMcpConnectorSwr()
    const syncSwr = useMutateSyncMcpConnectorSwr()
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const approveTrigger = approveSwr.trigger
    const checkTrigger = checkSwr.trigger
    const syncTrigger = syncSwr.trigger

    const approve = useCallback(
        async (key: string) => {
            setBusyKey(key)
            const count = await runGraphQL(() => approveTrigger({ key }), { successMessage: t("approveDone") })
            setBusyKey(null)
            if (count !== undefined) await reload()
        },
        [approveTrigger, reload, runGraphQL, t],
    )
    const check = useCallback(
        async (key: string) => {
            setBusyKey(key)
            const status = await runGraphQL(() => checkTrigger({ key }), { showSuccessToast: false })
            setBusyKey(null)
            if (status !== undefined) await reload()
        },
        [checkTrigger, reload, runGraphQL],
    )
    const test = useCallback(
        async (key: string) => {
            setBusyKey(key)
            const count = await runGraphQL(() => syncTrigger({ key }), { showSuccessToast: false })
            setBusyKey(null)
            if (count !== undefined) await reload()
        },
        [syncTrigger, reload, runGraphQL],
    )
    return { approve, check, test, busyKey }
}
