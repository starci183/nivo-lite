"use client"

import { useTranslations } from "next-intl"
import { useAgentProfile, useProfileRegion, useTagRole } from "@/hooks/agentProfile"
import { mapSlot } from "@/hooks/slot"
import { moduleGlyphOf, useAgentPictures } from "@/hooks/installations"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { agentProfileHref, workspaceHref } from "@/modules/routes"
import { AgentProfileTagsBase } from "./component"

/** The agent whose tag list the card shows. */
type AgentProfileTagsProps = {
    readonly agentId: string
}

/** The connected "Agent duoc tag tiep" list: the agents this agent may pass work to, each a row that opens that agent. */
export const AgentProfileTags = (props: AgentProfileTagsProps) => {
    const t = useTranslations("agentProfile")
    const router = navigation.useRouter()
    const roleOf = useTagRole()
    const pictureOf = useAgentPictures()
    const workspaceId = useWorkspaceId()
    const { slot: profile } = useAgentProfile(props.agentId)
    const fromName = "items" in profile ? profile.items.name : ""
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
                            description: t("tagsWhy", { role: roleOf(target.module), from: fromName }),
                            mark: {
                                glyph: moduleGlyphOf(target.module),
                                module: target.module,
                                avatarUrl: pictureOf({ name: target.name }),
                            },
                            badges: target.isActive ? [] : [{ label: t("chip_paused"), tone: "danger" as const }],
                            meta: null,
                            open: () => router.push(workspaceHref(workspaceId, agentProfileHref(target.id))),
                        })),
                    ),
                    placeholder: [],
                    labels: region.labels(t("tagsEmpty")),
                },
                count: "items" in region.slot ? region.slot.items.length : null,
                isAttention: false,
                action: null,
            }}
            on={{ retry: region.reload }}
        />
    )
}
