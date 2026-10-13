"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSetConnectionGrant } from "@/hooks/connections"
import { useSave } from "@/hooks/modules"
import { dbFailure, dbOk } from "@/modules/db/outcome"
import { AgentConnectionAccessBase } from "./component"
import type { AgentConnectionAccessRow } from "./component"

const NONE = "none"
const LEVELS = ["read", "ask", "auto"] as const
const PURPOSES = ["inbound_chat", "outbound_chat", "bank_feed", "lead_source"] as const
const STATUS_TONE = { connected: "success", error: "danger", pending: "warning", disconnected: "neutral" } as const

/** One connection as the settings page prepared it: its status, what the agent does through it and the level the agent has. */
type AgentConnection = {
    readonly id: string
    readonly label: string
    readonly status: keyof typeof STATUS_TONE
    readonly purpose: string | null
    /** The level of this agent: one of read, ask, auto, or empty for none. */
    readonly access: string
}

/** What the settings page hands the block. */
type AgentConnectionAccessProps = {
    readonly agentId: string
    readonly connections: ReadonlyArray<AgentConnection>
    /** The workspace owner only; everyone else sees the same levels read-only. */
    readonly canEdit: boolean
    readonly manageHref: string
}

/** The connected card of the connections an agent uses: a pick is saved at once and goes back when it is refused. */
export const AgentConnectionAccess = (props: AgentConnectionAccessProps) => {
    const t = useTranslations("modulesCore")
    const [local, setLocal] = useState<Readonly<Record<string, string>>>({})
    const { note, isPending, save } = useSave()
    const setGrant = useSetConnectionGrant()
    const levelOf = (connection: AgentConnection): string =>
        connection.id in local ? (local[connection.id] ?? NONE) : connection.access || NONE
    const rows: ReadonlyArray<AgentConnectionAccessRow> = props.connections.map((connection) => ({
        id: connection.id,
        label: connection.label,
        statusLabel: t(`connStatus_${connection.status}`),
        statusTone: STATUS_TONE[connection.status],
        purposeLabel: PURPOSES.some((purpose) => purpose === connection.purpose)
            ? t(`grantPurpose_${connection.purpose}`)
            : "",
        access: levelOf(connection),
        isDisconnected: connection.status === "disconnected",
    }))
    return (
        <AgentConnectionAccessBase
            props={{
                title: t("grantTitle"),
                hint: t("grantHint"),
                emptyText: t("grantEmpty"),
                manageLabel: t("grantManage"),
                manageHref: props.manageHref,
                ownerOnlyText: t("grantOwnerOnly"),
                levels: [NONE, ...LEVELS].map((level) => ({ id: level, label: t(`grant_${level}`) })),
                rows,
                canEdit: props.canEdit,
                isDisabled: !props.canEdit || isPending,
                noteTone: note.tone,
                noteText: note.tone === "saved" ? t("grantSaved") : note.text,
            }}
            on={{
                pick: (connectionId, level) => {
                    const connection = props.connections.find((candidate) => candidate.id === connectionId)
                    if (connection === undefined || level === null || level === levelOf(connection)) return
                    const before = levelOf(connection)
                    setLocal((current) => ({ ...current, [connectionId]: level }))
                    save(
                        async () => {
                            const granted = await setGrant(
                                connectionId,
                                props.agentId,
                                LEVELS.find((candidate) => candidate === level) ?? null,
                            )
                            return granted.kind === "ok" ? dbOk(true) : dbFailure("refused", granted.message)
                        },
                        t("grantSaved"),
                        () => setLocal((current) => ({ ...current, [connectionId]: before })),
                    )
                },
            }}
        />
    )
}
