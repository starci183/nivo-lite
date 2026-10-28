"use client"

import { useTranslations } from "next-intl"
import { useAgentProfile } from "@/hooks/agentProfile"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentProfileOwnerBase } from "./component"
import type { OwnerView } from "./component"

/** The agent whose owner the card shows. */
type AgentProfileOwnerProps = {
    readonly agentId: string
}

const PLACEHOLDER: OwnerView = { name: "-", roleLabel: "-", note: "-", notice: null, fallback: null }

/** The connected "Nguoi phu trach" card: who answers for the agent now, and who comes after them. */
export const AgentProfileOwner = (props: AgentProfileOwnerProps) => {
    const t = useTranslations("agentProfile")
    const slotLabels = useSlotLabels()
    const { slot, reload } = useAgentProfile(props.agentId)
    return (
        <AgentProfileOwnerBase
            props={{
                title: t("ownerTitle"),
                read: {
                    slot: mapSlot(slot, (agent): OwnerView => {
                        const people = [agent.owner, agent.fallback]
                        const responder = people.find(
                            (person) => person?.memberId === agent.responderId && person.isActive,
                        )
                        const storedIsGone = !agent.owner?.isActive
                        const fallback = agent.fallback
                        return {
                            name: responder?.name ?? t("ownerNone"),
                            roleLabel: responder === undefined || responder === null ? "" : t(`role_${responder.role}`),
                            note: t("ownerNote"),
                            notice: storedIsGone
                                ? {
                                      title: t("ownerGoneTitle"),
                                      description: t("ownerGoneBody", { name: responder?.name ?? "" }),
                                  }
                                : null,
                            fallback:
                                fallback !== null && fallback.isActive && fallback.memberId !== responder?.memberId
                                    ? { label: t("fallbackLabel"), name: fallback.name }
                                    : null,
                        }
                    }),
                    placeholder: PLACEHOLDER,
                    labels: slotLabels(t("ownerNone")),
                },
            }}
            on={{ retry: reload }}
        />
    )
}
