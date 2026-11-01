"use client"

import { useTranslations } from "next-intl"
import { useOverviewData, useOverviewRail } from "@/hooks/overview"
import { moduleGlyphOf, useAgentPictures } from "@/hooks/installations"
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

/** What the rail holds while the dashboard is read: both cards draw as skeleton. */
const NO_RAIL = { agents: [], activity: [] } as const

/** The overview rail with its copy resolved in the browser. */
export const OverviewRail = () => {
    const t = useTranslations("overview")
    const tAgent = useTranslations("modulesCore")
    const read = useOverviewRail()
    const pictureOf = useAgentPictures()
    const { failed } = useOverviewData()
    if (read === undefined && failed) return null
    const data = read ?? NO_RAIL
    const hasChatbot = data.agents.some((agent) => agent.module === "chatbot")
    return (
        <OverviewRailBase
            props={{
                agentsTitle: t("agents"),
                agentsEmpty: t("agentsEmpty"),
                agentsEmptyBody: t("agentsEmptyDesc"),
                chatLabel: t("chat"),
                buyChatbotLabel: hasChatbot || read === undefined ? null : t("buyChatbot"),
                buyChatbotHref: CONSOLE_ROUTES.newChatbot,
                agents: data.agents.map((agent) => ({
                    id: agent.id,
                    module: agent.module,
                    glyph: moduleGlyphOf(agent.module),
                    name: agent.name,
                    avatarUrl: pictureOf({ handle: agent.handle, name: agent.name }),
                    isActive: agent.lifecycle === "running",
                    statusLabel: tAgent(`lifecycle_${agent.lifecycle}`),
                    chatHref: agentChatHref(agent.id),
                })),
                activityTitle: t("activity"),
                activityEmpty: t("activityEmpty"),
                activityEmptyBody: t("activityEmptyDesc"),
                viewAllLabel: t("viewAll"),
                viewAllHref: CONSOLE_ROUTES.responsibilities,
                isSkeleton: read === undefined,
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
