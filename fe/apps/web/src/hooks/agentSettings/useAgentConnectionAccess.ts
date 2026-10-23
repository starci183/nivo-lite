"use client"

import { useTranslations } from "next-intl"
import { useCallback, useMemo } from "react"
import { isDataConnector, purposeFor } from "@/hooks/connection-access"
import { slotOfSwr } from "@/hooks/slot"
import {
    useMutateGrantAgentConnectionSwr,
    useMutateRevokeAgentConnectionSwr,
    useQueryAgentConnectionsSwr,
    useQueryConnectionsSwr,
} from "@/hooks/swr"
import { MODULE_REGISTRY, isModuleKey } from "@/modules/catalog"
import { useGraphQLWithToast } from "@/modules/toast"
import type { DataSlot } from "@/modules/types"
import { toAgentConnection } from "./agentSettings.shared"
import type { AgentConnectionView } from "./agentSettings.shared"
import { readError } from "@/hooks/workspaceread"

const NO_ACCESS = "none"

/**
 * The connections an agent can work through, with the level it has on each, and the way to change a level ("none" removes it). The agent
 * is offered the data connectors of the workspace and the providers its module declares; a disconnected connection stays only when the
 * agent still holds a grant on it. A change answers whether it worked; a failure was already toasted with the server message.
 */
export const useAgentConnectionAccess = (agentId: string | null, moduleKey: string) => {
    const t = useTranslations("modulesCore")
    const runGraphQL = useGraphQLWithToast()
    const all = useQueryConnectionsSwr()
    const granted = useQueryAgentConnectionsSwr(agentId === null ? null : { agentId })
    const grant = useMutateGrantAgentConnectionSwr()
    const revoke = useMutateRevokeAgentConnectionSwr()
    const rows = useMemo((): ReadonlyArray<AgentConnectionView> | undefined => {
        if (all.data === undefined || granted.data === undefined) return undefined
        const providers = isModuleKey(moduleKey) ? MODULE_REGISTRY[moduleKey].connectionProviders : []
        const heldBy = new Map(granted.data.map((connection) => [connection.id, connection.access]))
        return all.data
            .filter(
                (connection) =>
                    purposeFor(moduleKey, connection.provider) !== null &&
                    (isDataConnector(connection.provider) || providers.includes(connection.provider)) &&
                    (connection.status !== "disconnected" || heldBy.has(connection.id)),
            )
            .map((connection) =>
                toAgentConnection({
                    ...connection,
                    purpose: purposeFor(moduleKey, connection.provider) ?? "",
                    access: heldBy.get(connection.id) ?? "",
                }),
            )
    }, [all.data, granted.data, moduleKey])
    const { mutate } = granted
    const pick = useCallback(
        async (connection: AgentConnectionView, level: string): Promise<boolean> => {
            if (agentId === null) return false
            const done = await runGraphQL(
                () =>
                    level === NO_ACCESS
                        ? revoke.trigger({ agentId, connectionId: connection.id })
                        : grant.trigger({
                              agentId,
                              connectionId: connection.id,
                              access: level,
                              purpose: connection.purpose,
                          }),
                { successMessage: t("grantSaved") },
            )
            await mutate()
            return done !== undefined
        },
        [agentId, runGraphQL, grant, revoke, mutate, t],
    )
    const slot: DataSlot<ReadonlyArray<AgentConnectionView>> = slotOfSwr({
        data: rows,
        error: readError(all) ?? readError(granted),
        isLoading: all.isLoading || granted.isLoading,
    })
    return { slot, pick, isSaving: grant.isMutating || revoke.isMutating }
}
