"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    hasBoundConnection,
    useAgentConnectionAccess,
    useAgentInstallation,
    useAgentRights,
} from "@/hooks/agentSettings"
import type { AgentConnectionView } from "@/hooks/agentSettings"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AUTOMATION_ROUTES } from "@/modules/routes"
import { AgentConnectionAccessBase } from "./component"
import type { AgentConnectionAccessRow } from "./component"

const NONE = "none"
const LEVELS = ["read", "ask", "auto"] as const
const PURPOSES = ["inbound_chat", "outbound_chat", "bank_feed", "lead_source"] as const
const STATUS_TONE = { connected: "success", error: "danger", pending: "warning", disconnected: "neutral" } as const
const PLACEHOLDER: ReadonlyArray<AgentConnectionAccessRow> = []

/** What the settings page hands the card: the instance of the url. */
type AgentConnectionAccessProps = {
    readonly installationId: string
    readonly module: string
}

const SHIFTS = "shifts"

/** The connected card of the connections an agent uses: a pick shows at once and goes back when the server refuses it. */
export const AgentConnectionAccess = (props: AgentConnectionAccessProps) => {
    const t = useTranslations("modulesCore")
    const slotLabels = useSlotLabels()
    const { canGrant } = useAgentRights()
    const installation = useAgentInstallation(props.installationId, props.module).slot.items
    const { slot, pick, isSaving } = useAgentConnectionAccess(installation?.agentId ?? null, props.module)
    const [local, setLocal] = useState<Readonly<Record<string, string>>>({})
    const connections = slot.items ?? []
    const levelOf = (connection: AgentConnectionView): string =>
        connection.id in local ? (local[connection.id] ?? NONE) : connection.access || NONE
    const rowsOf = (items: ReadonlyArray<AgentConnectionView>): ReadonlyArray<AgentConnectionAccessRow> =>
        items.map((connection) => ({
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
    const change = async (connection: AgentConnectionView, level: string) => {
        setLocal((current) => ({ ...current, [connection.id]: level }))
        await pick(connection, level)
        setLocal((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== connection.id)))
    }
    const isUnbound = props.module === SHIFTS && slot.items !== undefined && !hasBoundConnection(connections)
    return (
        <AgentConnectionAccessBase
            props={{
                title: t("grantTitle"),
                hint: t("grantHint"),
                slot: mapSlot(slot, (items) => ({ rows: rowsOf(items) })),
                placeholder: { rows: PLACEHOLDER },
                slotLabels: slotLabels(t("grantEmpty")),
                manageLabel: t("grantManage"),
                manageHref: AUTOMATION_ROUTES.connections,
                ownerOnlyText: t("grantOwnerOnly"),
                levels: [NONE, ...LEVELS].map((level) => ({ id: level, label: t(`grant_${level}`) })),
                canEdit: canGrant,
                isDisabled: !canGrant || isSaving,
                notice: isUnbound ? t("shiftsBindChannel") : "",
            }}
            on={{
                pick: (connectionId, level) => {
                    const connection = connections.find((candidate) => candidate.id === connectionId)
                    if (connection === undefined || level === null || level === levelOf(connection)) return
                    void change(connection, level)
                },
            }}
        />
    )
}
