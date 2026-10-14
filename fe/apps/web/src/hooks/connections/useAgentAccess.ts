"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { ACCESS_LEVELS, purposeFor } from "@/hooks/connection-access"
import type { Settled } from "@/hooks/connection-wizard"
import type { Access, AccessView, AgentOption, Connection } from "@/modules/types"

/** The picker view of one row and the pick handler; null when the provider is not one agents work through. */
export interface AgentAccess {
    readonly view: AccessView
    readonly pick: (agentId: string, value: string) => void
}

const NONE = "none"

/** Gives one agent a level through the connection, or removes its access (null); the connected row binds the GraphQL mutation. */
export type GrantCommand = (agentId: string, access: Access | null) => Promise<Settled<true>>

/**
 * "Which agents work through this connection, and how far": each pick is saved at once with the same grant the agent's own
 * settings show, undone when the server refuses, and reported through `onError`.
 */
export const useAgentAccess = (
    connection: Connection,
    agents: ReadonlyArray<AgentOption>,
    canEdit: boolean,
    setGrant: GrantCommand,
    onError: (message: string) => void,
): AgentAccess => {
    const t = useTranslations("connections")
    const [pending, startTransition] = useTransition()
    const [local, setLocal] = useState<Readonly<Record<string, Access | null>>>({})
    const accessOf = (agentId: string): Access | null =>
        agentId in local
            ? (local[agentId] ?? null)
            : (connection.grants.find((grant) => grant.agentId === agentId)?.access ?? null)

    const level = (access: Access | null): string => (access === null ? t("accessNone") : t(`access_${access}`))
    const granted = agents.filter((agent) => accessOf(agent.id) !== null)
    const summary =
        granted.length === 0
            ? t("accessNobody")
            : granted.map((agent) => `${agent.name} (${level(accessOf(agent.id))})`).join(", ")

    const pick = (agentId: string, value: string) => {
        const next: Access | null = ACCESS_LEVELS.find((candidate) => candidate === value) ?? null
        const before = accessOf(agentId)
        if (before === next) return
        setLocal((previous) => ({ ...previous, [agentId]: next }))
        startTransition(async () => {
            const result = await setGrant(agentId, next)
            if (result.kind === "ok") return
            setLocal((previous) => ({ ...previous, [agentId]: before }))
            onError(result.message)
        })
    }

    return {
        pick,
        view: {
            isEditable: canEdit,
            summary: t("accessReadOnly", { summary }),
            triggerLabel: granted.length === 0 ? t("accessAssign") : t("accessButton", { count: granted.length }),
            isPending: pending,
            emptyLabel: t("accessNoAgents"),
            unusableLabel: t("accessUnusable"),
            agents: agents.map((agent) => ({
                id: agent.id,
                name: agent.name,
                isUsable: purposeFor(agent.module, connection.provider) !== null,
                current: accessOf(agent.id) ?? NONE,
                options: [NONE, ...ACCESS_LEVELS].map((value) =>
                    value === NONE
                        ? { value, label: t("accessNone") }
                        : { value, label: t(`access_${value}`), description: t(`accessHint_${value}`) },
                ),
            })),
        },
    }
}
