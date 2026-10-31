"use client"

import { useTranslations } from "next-intl"
import { useConnectionsRole } from "@/hooks/connections"
import { useSepayAgents, useSepayConnection, useSepayPlaceholder } from "@/hooks/sepayConnection"
import { useSlotLabels } from "@/hooks/slot"
import type { SepayAgentView } from "@/modules/types"
import { SepayAgentsBase } from "./component"

/** What the page hands the step body: the connection of the url. */
type SepayAgentsProps = { readonly connectionId: string }

/** The connected last setup step: how matching works and the accounting agents that may book the credits of this connection. */
export const SepayAgents = (props: SepayAgentsProps) => {
    const t = useTranslations("sepayConnection")
    const slotLabels = useSlotLabels()
    const connection = useSepayConnection(props.connectionId)
    const connectionPlaceholder = useSepayPlaceholder()
    const placeholder: ReadonlyArray<SepayAgentView> = [{ id: "placeholder", name: t("title"), isOn: true }]
    const { role } = useConnectionsRole()
    const agents = useSepayAgents(
        props.connectionId,
        connection.slot.items?.agentIds ?? connectionPlaceholder.agentIds,
        connection.slot.items !== undefined,
    )
    return (
        <SepayAgentsBase
            props={{
                matching: t("matchingRule"),
                slot: connection.slot.isError === true ? { isError: true } : agents.slot,
                placeholder,
                labels: slotLabels(t("agentsEmpty")),
                isDisabled: role !== "owner" || connection.slot.items?.status === "disconnected",
            }}
            on={{
                retry: () => {
                    connection.retry()
                    agents.retry()
                },
                toggle: (agentId, isOn) => void agents.toggle(agentId, isOn),
            }}
        />
    )
}
