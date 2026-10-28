"use client"

import { useTranslations } from "next-intl"
import { useProfileRegion } from "@/hooks/agentProfile"
import { mapSlot } from "@/hooks/slot"
import { moduleGlyphOf } from "@/hooks/installations"
import { AgentProfileTagsBase } from "./component"

/** The agent whose tag list the card shows. */
type AgentProfileTagsProps = {
    readonly agentId: string
}

/** The connected "Agent duoc tag tiep" card: the agents this agent may pass work to. */
export const AgentProfileTags = (props: AgentProfileTagsProps) => {
    const t = useTranslations("agentProfile")
    const g = useTranslations("governance")
    const region = useProfileRegion(props.agentId, (agent) => ({ isFailed: false, items: agent.canTag }))
    return (
        <AgentProfileTagsBase
            props={{
                label: t("tagsTitle"),
                read: {
                    slot: mapSlot(region.slot, (items) =>
                        items.map((target) => ({
                            id: target.id,
                            title: target.name,
                            description: g.has(`dept_${target.module}`) ? g(`dept_${target.module}`) : target.module,
                            mark: { glyph: moduleGlyphOf(target.module), module: target.module },
                            badges: [
                                { label: t("aiChip"), tone: "neutral" },
                                ...(target.isActive ? [] : [{ label: t("chip_paused"), tone: "danger" as const }]),
                            ],
                        })),
                    ),
                    placeholder: [],
                    labels: region.labels(t("tagsEmpty")),
                },
                footer: null,
            }}
            on={{ retry: region.reload }}
        />
    )
}
