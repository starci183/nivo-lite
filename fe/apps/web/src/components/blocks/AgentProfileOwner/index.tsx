"use client"

import { useTranslations } from "next-intl"
import { personNameOf, useAgentProfile } from "@/hooks/agentProfile"
import { useInstallations } from "@/hooks/installations"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentProfileOwnerBase, type OwnerView } from "./component"

/** The agent whose owner the card shows: named by its id, or by the instance that drives it (the card waits until that is known). */
type AgentProfileOwnerProps = {
    readonly agentId?: string
    readonly installationId?: string
}

const PLACEHOLDER: OwnerView = { name: "-", roleLabel: "-", notice: null, fallback: null }

/** The connected "Nguoi phu trach" card: who answers for the agent now, and who comes after them. */
export const AgentProfileOwner = (props: AgentProfileOwnerProps) => {
    const t = useTranslations("agentProfile")
    const slotLabels = useSlotLabels()
    const { installations } = useInstallations()
    const ofInstance = installations?.find((entry) => entry.id === props.installationId)?.agentId ?? null
    const { slot, reload } = useAgentProfile(props.agentId ?? ofInstance)
    return (
        <AgentProfileOwnerBase
            props={{
                title: t("ownerTitle"),
                description: t("ownerNote"),
                read: {
                    slot: mapSlot(slot, (agent): OwnerView => {
                        const people = [agent.owner, agent.fallback]
                        const responder = people.find(
                            (person) => person?.memberId === agent.responderId && person.isActive,
                        )
                        const storedIsGone = !agent.owner?.isActive
                        const fallback = agent.fallback
                        return {
                            name: responder === undefined || responder === null ? t("ownerNone") : personNameOf(responder.name),
                            roleLabel: responder === undefined || responder === null ? "" : t(`role_${responder.role}`),
                                            notice: storedIsGone
                                ? {
                                      title: t("ownerGoneTitle"),
                                      description: t("ownerGoneBody", { name: personNameOf(responder?.name ?? "") }),
                                  }
                                : null,
                            fallback:
                                fallback !== null && fallback.isActive && fallback.memberId !== responder?.memberId
                                    ? { label: t("fallbackLabel"), name: personNameOf(fallback.name) }
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
