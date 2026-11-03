"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal, useConnectionsRole } from "@/hooks/connections"
import { useSepayAgents, useSepayConnection, useSepayPlaceholder, useSepaySetupStep } from "@/hooks/sepayConnection"
import { slotOfReads, useSlotLabels } from "@/hooks/slot"
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
    const setup = useSepaySetupStep(props.connectionId, "agents")
    const agents = useSepayAgents(
        props.connectionId,
        ("items" in connection.slot ? connection.slot.items : undefined)?.agentIds ?? connectionPlaceholder.agentIds,
        ("items" in connection.slot ? connection.slot.items : undefined) !== undefined,
    )
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <SepayAgentsBase
            props={{
                step: setup.step,
                matching: t("matchingRule"),
                slot: slotOfReads([connection.read, agents.read], () => agents.read.data),
                placeholder,
                labels: slotLabels(t("agentsEmpty")),
                isDisabled:
                    role !== "owner" ||
                    ("items" in connection.slot ? connection.slot.items : undefined)?.status === "disconnected",
            }}
            on={{
                toggleStep: setup.toggle,
                retry: () => {
                    connection.retry()
                    agents.retry()
                },
                toggle: (agentId, isOn) => void agents.toggle(agentId, isOn),
            }}
        />
    )
}
