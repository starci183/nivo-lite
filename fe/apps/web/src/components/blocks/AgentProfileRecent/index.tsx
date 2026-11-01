"use client"

import { useTranslations } from "next-intl"
import { useProfileRegion } from "@/hooks/agentProfile"
import { mapSlot } from "@/hooks/slot"
import { AgentProfileRecentBase } from "./component"
import { actionWordOf } from "@/hooks/actionWord"

/** The agent whose recent work the card lists. */
type AgentProfileRecentProps = {
    readonly agentId: string
}

const TONE: Readonly<Record<string, "neutral" | "success" | "warning" | "danger">> = {
    queued: "neutral",
    done: "success",
    waiting_decision: "warning",
    rejected: "danger",
    failed: "danger",
}

/** The connected "Viec gan day" card: the latest work of the agent, whatever its state. */
export const AgentProfileRecent = (props: AgentProfileRecentProps) => {
    const t = useTranslations("agentProfile")
    const g = useTranslations("governance")
    const region = useProfileRegion(props.agentId, (agent) => agent.recent)
    const actionLabel = (action: string): string => actionWordOf(g, action)
    return (
        <AgentProfileRecentBase
            props={{
                label: t("recentTitle"),
                read: {
                    slot: mapSlot(region.slot, (items) =>
                        items.map((work) => ({
                            id: work.id,
                            title: work.title === "" ? actionLabel(work.action) : work.title,
                            description: work.customer,
                            mark: null,
                            badges: [{ label: t(`workStatus_${work.status}`), tone: TONE[work.status] ?? "neutral" }],
                        })),
                    ),
                    placeholder: [],
                    labels: region.labels(t("recentEmpty")),
                },
                footer: null,
            }}
            on={{ retry: region.reload }}
        />
    )
}
