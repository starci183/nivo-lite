"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { ACCESS_LEVELS, purposeFor } from "@/hooks/connection-access"
import { useConnectionsData, useConnectionsRole, useSetConnectionGrant } from "@/hooks/connections"
import { slotOfReads } from "@/hooks/slot"
import type { Access, ConnectionGrantsView, DataSlot } from "@/modules/types"

/** The level a new grant starts at: the agent asks before it sends anything. */
const FIRST_LEVEL: Access = "ask"

/** The choice that removes an agent from the connection. */
const REMOVE = "none"

/** What the agents-of-a-connection section reads and the commands behind it. */
interface ConnectionGrantsRead {
    readonly slot: DataSlot<ConnectionGrantsView>
    /** Gives an agent a level through this connection, or removes it (`none`). */
    readonly pick: (agentId: string, level: string) => void
    /** Gives an agent the first level through this connection. */
    readonly assign: (agentId: string) => void
    readonly retry: () => void
}

/**
 * The agents that work through one connection, each with its level (read only, ask first, act, or removed), and the agents that could
 * be given it. Agent and connection are many to many with a level per pair: every command here is one `setConnectionGrant`.
 * Only the owner changes a level; the back end refuses everyone else.
 */
export const useConnectionGrants = (connectionId: string): ConnectionGrantsRead => {
    const t = useTranslations("connections")
    const data = useConnectionsData()
    const access = useConnectionsRole()
    const setGrant = useSetConnectionGrant()
    const connection = data.items.find((item) => item.id === connectionId)
    const granted = new Map((connection?.grants ?? []).map((grant) => [grant.agentId, grant.access]))
    const view: ConnectionGrantsView = {
        canManage: access.role === "owner",
        levels: [
            ...ACCESS_LEVELS.map((level) => ({ id: level, label: t(`access_${level}`) })),
            { id: REMOVE, label: t("grantRemove") },
        ],
        rows: [...granted.entries()].map(([agentId, level]) => ({
            id: agentId,
            name: data.agentNames[agentId] ?? agentId,
            levelLabel: t("levelLabel", { name: data.agentNames[agentId] ?? agentId }),
            level,
        })),
        candidates: data.activeAgents
            .filter(
                (agent) =>
                    !granted.has(agent.id) &&
                    connection !== undefined &&
                    purposeFor(agent.module, connection.provider) !== null,
            )
            .map((agent) => ({ id: agent.id, label: agent.name })),
    }
    const slot = slotOfReads([access.read, ...data.reads], () => (connection === undefined ? undefined : view))
    const pick = useCallback(
        (agentId: string, level: string): void => {
            const next: Access | undefined = ACCESS_LEVELS.find((candidate) => candidate === level)
            if (level === REMOVE) void setGrant(connectionId, agentId, null)
            else if (next !== undefined) void setGrant(connectionId, agentId, next)
        },
        [connectionId, setGrant],
    )
    const assign = useCallback(
        (agentId: string): void => void setGrant(connectionId, agentId, FIRST_LEVEL),
        [connectionId, setGrant],
    )
    return {
        slot,
        pick,
        assign,
        retry: () => {
            access.retry()
            data.retry()
        },
    }
}
