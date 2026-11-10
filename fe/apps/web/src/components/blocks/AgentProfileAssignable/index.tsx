"use client"

import { useTranslations } from "next-intl"
import { useAgentProfile } from "@/hooks/agentProfile"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentProfileAssignableBase, type AssignerChip } from "./component"

/** The agent whose assigners the field shows. */
type AgentProfileAssignableProps = {
    readonly agentId: string
}

const PLACEHOLDER: ReadonlyArray<AssignerChip> = [
    { id: "a", label: "-----------" },
    { id: "b", label: "-------" },
]

/** The connected "Ai duoc giao viec" field: the roles and rooms that may hand the agent work. */
export const AgentProfileAssignable = (props: AgentProfileAssignableProps) => {
    const t = useTranslations("agentProfile")
    const slotLabels = useSlotLabels()
    const { slot, reload } = useAgentProfile(props.agentId)
    return (
        <AgentProfileAssignableBase
            props={{
                title: t("assignableTitle"),
                description: t("assignableDesc"),
                read: {
                    slot: mapSlot(slot, (agent): ReadonlyArray<AssignerChip> => [
                        ...agent.assignableRoles.map((role) => ({ id: `role:${role}`, label: t(`role_${role}`) })),
                        ...agent.assignableRooms.map((room) => ({ id: `room:${room}`, label: room })),
                    ]),
                    placeholder: PLACEHOLDER,
                    labels: slotLabels(t("assignableEmpty")),
                },
            }}
            on={{ retry: reload }}
        />
    )
}
