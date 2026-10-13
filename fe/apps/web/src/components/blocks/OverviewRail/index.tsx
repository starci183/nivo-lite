"use client"

import { useTranslations } from "next-intl"
import { useOverviewRail } from "@/hooks/overview"
import { MODULE_REGISTRY } from "@/modules/catalog"
import { CONSOLE_ROUTES, agentChatHref, leadHref } from "@/modules/routes"
import type { IconName } from "@/components/leaves/Icon"
import { OverviewRailBase } from "./component"

/** The glyph of each kind of activity. */
const KIND_ICONS: Readonly<Record<string, IconName>> = {
    "lead.captured": "account",
    "context.summarised": "talents",
    "responsibility.assigned": "review",
    "execution.drafted": "send",
    "execution.approved": "complete",
    "execution.rejected": "close",
    "outcome.recorded": "saved",
    "agent.installed": "agentos",
    "agent.updated": "agentos",
}

/** The overview rail with its copy resolved in the browser. */
export const OverviewRail = () => {
    const t = useTranslations("overview")
    const data = useOverviewRail()
    if (data === undefined) return null
    const hasChatbot = data.agents.some((agent) => agent.module === "chatbot")
    return (
        <OverviewRailBase
            props={{
                agentsTitle: t("agents"),
                agentsEmpty: t("agentsEmpty"),
                agentsEmptyBody: t("agentsEmptyDesc"),
                chatLabel: t("chat"),
                buyChatbotLabel: hasChatbot ? null : t("buyChatbot"),
                buyChatbotHref: CONSOLE_ROUTES.newChatbot,
                agents: data.agents.map((agent) => ({
                    id: agent.id,
                    module: agent.module,
                    glyph: MODULE_REGISTRY[agent.module].glyph,
                    name: agent.name,
                    isActive: agent.isActive,
                    statusLabel: agent.isActive ? t("active") : t("paused"),
                    chatHref: agentChatHref(agent.id),
                })),
                activityTitle: t("activity"),
                activityEmpty: t("activityEmpty"),
                activityEmptyBody: t("activityEmptyDesc"),
                viewAllLabel: t("viewAll"),
                viewAllHref: CONSOLE_ROUTES.responsibilities,
                activity: data.activity.map((item) => ({
                    id: item.id,
                    icon: KIND_ICONS[item.kind] ?? "notification",
                    actor: item.actor,
                    summary: item.summary,
                    timeLabel: item.timeLabel,
                    href: item.leadId === null ? null : leadHref(item.leadId),
                })),
            }}
        />
    )
}
