"use client"

import { useTranslations } from "next-intl"
import { useAgentProfile } from "@/hooks/agentProfile"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentProfileAssignableBase } from "./component"
import type { AssignerRow } from "./component"

/** The agent whose assigners the card shows. */
type AgentProfileAssignableProps = {
    readonly agentId: string
}

const PLACEHOLDER: ReadonlyArray<AssignerRow> = [{ id: "roles", term: "-", description: "-" }]

/** The connected "Ai duoc giao viec cho agent" card: the roles and rooms that may hand the agent work. */
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
                    slot: mapSlot(slot, (agent): ReadonlyArray<AssignerRow> => [
                        ...(agent.assignableRoles.length === 0
                            ? []
                            : [
                                  {
                                      id: "roles",
                                      term: t("assignableRole"),
                                      description: agent.assignableRoles.map((role) => t(`role_${role}`)).join(", "),
                                  },
                              ]),
                        ...(agent.assignableRooms.length === 0
                            ? []
                            : [
                                  {
                                      id: "rooms",
                                      term: t("assignableRoom"),
                                      description: agent.assignableRooms.join(", "),
                                  },
                              ]),
                    ]),
                    placeholder: PLACEHOLDER,
                    labels: slotLabels(t("assignableEmpty")),
                },
            }}
            on={{ retry: reload }}
        />
    )
}
