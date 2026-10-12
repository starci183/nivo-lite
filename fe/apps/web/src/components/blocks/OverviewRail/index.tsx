import { getTranslations } from "next-intl/server"
import type { OnboardingStep } from "@/features/promo/queries"
import type { ActivityModel } from "@/features/responsibilities/format"
import type { Agent } from "@/lib/types"
import { CONSOLE_ROUTES, agentChatHref, leadHref } from "@/modules/routes"
import type { IconName } from "@/ui"
import { OverviewRailBase } from "./component"

/** The agents, the recent activity and the onboarding steps the rail shows. */
interface OverviewRailProps {
    readonly agents: ReadonlyArray<Agent>
    readonly activity: ReadonlyArray<ActivityModel>
    readonly steps: ReadonlyArray<OnboardingStep>
}

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

/** The overview rail with its copy resolved on the server. */
export const OverviewRail = async (props: OverviewRailProps) => {
    const t = await getTranslations("overview")
    const hasChatbot = props.agents.some((agent) => agent.module === "chatbot")
    return (
        <OverviewRailBase
            props={{
                steps: props.steps,
                agentsTitle: t("agents"),
                agentsEmpty: t("agentsEmpty"),
                agentsEmptyBody: t("agentsEmptyDesc"),
                chatLabel: t("chat"),
                buyChatbotLabel: hasChatbot ? null : t("buyChatbot"),
                buyChatbotHref: CONSOLE_ROUTES.newChatbot,
                agents: props.agents.map((agent) => ({
                    id: agent.id,
                    module: agent.module,
                    name: agent.name,
                    isActive: agent.status === "active",
                    statusLabel: agent.status === "active" ? t("active") : t("paused"),
                    chatHref: agentChatHref(agent.id),
                })),
                activityTitle: t("activity"),
                activityEmpty: t("activityEmpty"),
                activityEmptyBody: t("activityEmptyDesc"),
                viewAllLabel: t("viewAll"),
                viewAllHref: CONSOLE_ROUTES.responsibilities,
                activity: props.activity.map((item) => ({
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
