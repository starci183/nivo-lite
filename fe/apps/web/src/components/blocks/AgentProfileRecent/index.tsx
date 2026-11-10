"use client"

import { useTranslations } from "next-intl"
import { groupRecent, useAgentPages, useProfileRegion } from "@/hooks/agentProfile"
import { mapSlot } from "@/hooks/slot"
import { AgentProfileRecentBase } from "./component"
import { actionWordOf } from "@/hooks/actionWord"

/** The agent whose recent work the card lists. */
type AgentProfileRecentProps = {
    readonly agentId: string
}

const TONE: Readonly<Record<string, "neutral" | "success" | "accent" | "danger">> = {
    queued: "neutral",
    done: "success",
    waiting_decision: "accent",
    rejected: "danger",
    failed: "danger",
}

/** The connected "Viec gan day" list: the latest work of the agent, identical lines folded into one with their count. */
export const AgentProfileRecent = (props: AgentProfileRecentProps) => {
    const t = useTranslations("agentProfile")
    const g = useTranslations("governance")
    const pages = useAgentPages(props.agentId)
    const region = useProfileRegion(props.agentId, (agent) => agent.recent)
    const actionLabel = (action: string): string => actionWordOf(g, action)
    return (
        <AgentProfileRecentBase
            props={{
                label: t("recentTitle"),
                read: {
                    slot: mapSlot(region.slot, (items) =>
                        groupRecent(items).map(({ work, times }) => ({
                            id: work.id,
                            title: work.title === "" ? actionLabel(work.action) : work.title,
                            description: work.customer,
                            mark: null,
                            badges: [{ label: t(`workStatus_${work.status}`), tone: TONE[work.status] ?? "neutral" }],
                            meta: times > 1 ? t("recentTimes", { count: times }) : null,
                            open: null,
                        })),
                    ),
                    placeholder: [],
                    labels: region.labels(t("recentEmpty")),
                },
                count: "items" in region.slot ? region.slot.items.length : null,
                isAttention: false,
                action: pages === null ? null : { label: t("recentAll"), href: pages.work },
            }}
            on={{ retry: region.reload }}
        />
    )
}
