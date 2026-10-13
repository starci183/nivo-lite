import { getTranslations } from "next-intl/server"
import { loadAgentDashboard } from "@/lib/agent-dashboard"
import { workbenchHref } from "@/lib/agent-dashboard-shared"
import { isManagerRole } from "@/lib/members-shared"
import { getSession } from "@/lib/session"
import { readChatbotGaps, readChatbotOverview, readChatbotThread } from "@/modules/db"
import type { DbOutcome } from "@/modules/db"
import type { ChatbotMetrics, ChatbotThread } from "@/modules/types"
import { ChatbotWorkbenchBase } from "./component"

/** Which conversation and which instance the route asks for. */
interface ChatbotWorkbenchProps {
    /** `?focus=` of the route: the conversation a waiting row leads to. */
    readonly focus: string | null
    /** The Chatbot instance id (one per branch or Fanpage): only its conversations, decisions and figures. */
    readonly installationId: string | null
}

type Translate = Awaited<ReturnType<typeof getTranslations>>

/** The first-reply figure: its value and the line under it. */
const responseOf = (metrics: ChatbotMetrics, t: Translate): { readonly value: string; readonly sub: string } => {
    const minutes = metrics.p50FirstResponseMin
    if (minutes === null) return { value: "-", sub: t("metricResponseNone") }
    const sub = t("metricResponseSub", { n: metrics.sample })
    if (minutes < 1) return { value: t("seconds", { n: Math.max(1, Math.round(minutes * 60)) }), sub }
    return { value: t("minutes", { n: Math.round(minutes * 10) / 10 }), sub }
}

/** The open thread, or why there is none: a missing conversation is nothing to show, anything else is a failed read. */
const threadOf = (
    outcome: DbOutcome<ChatbotThread> | null,
): { readonly thread: ChatbotThread | null; readonly failed: boolean } => {
    if (outcome === null) return { thread: null, failed: false }
    if (outcome.kind === "ok") return { thread: outcome.value, failed: false }
    return { thread: null, failed: outcome.kind !== "not-found" }
}

/**
 * Chatbot workbench (customer conversations): loads the inbox, the agent dashboard regions and the open thread, then hands over
 * to the realtime inbox. A waiting row opens the conversation it asks about (`?focus=<conversation id>`), else the newest opens.
 * Owners and managers also get the questions customers asked that the brain could not answer, to fill them in place.
 */
export const ChatbotWorkbench = async (props: ChatbotWorkbenchProps) => {
    const { installationId } = props
    const [t, session] = await Promise.all([getTranslations("workbenchChatbot"), getSession()])
    const workspaceId = session.workspace.id
    const [overview, dashboard] = await Promise.all([
        readChatbotOverview({ workspaceId, installationId }),
        loadAgentDashboard("chatbot", {
            installationId,
            decisionHref: (item) => {
                const conversation = item.proposal.fields?.conversation_id
                return workbenchHref("chatbot", {
                    installationId,
                    focus: typeof conversation === "string" ? conversation : (item.subject_id ?? undefined),
                })
            },
        }),
    ])
    const data = overview.kind === "ok" ? overview.value : null
    const selected = data?.conversations.find((item) => item.id === props.focus) ?? data?.conversations[0] ?? null
    const canFill = isManagerRole(session.member.role)
    const [thread, gaps] = await Promise.all([
        selected === null ? null : readChatbotThread({ workspaceId, conversationId: selected.id }),
        canFill ? readChatbotGaps(workspaceId) : null,
    ])
    const open = threadOf(thread)
    const shown = open.failed ? null : data
    const response = shown === null ? null : responseOf(shown.metrics, t)
    return (
        <ChatbotWorkbenchBase
            props={{
                overview: shown,
                thread: open.thread,
                selectedId: selected?.id ?? null,
                userName: session.userName,
                dashboard,
                figures:
                    shown === null || response === null
                        ? []
                        : [
                              {
                                  id: "today",
                                  term: t("metricToday"),
                                  description: String(shown.metrics.today),
                                  meta: t("metricTodaySub"),
                              },
                              {
                                  id: "waiting",
                                  term: t("metricWaiting"),
                                  description: String(shown.metrics.waiting),
                                  meta: t("metricWaitingSub"),
                              },
                              {
                                  id: "response",
                                  term: t("metricResponse"),
                                  description: response.value,
                                  meta: response.sub,
                              },
                              {
                                  id: "leads",
                                  term: t("metricLeads"),
                                  description: String(shown.metrics.leadsCaptured7d),
                                  meta: t("metricLeadsSub"),
                              },
                          ],
                tabLabel: t("title"),
                loadFailedTitle: t("loadError"),
                gaps:
                    gaps?.kind === "ok"
                        ? { gaps: gaps.value.gaps, lenses: gaps.value.lenses, business: session.workspace.name }
                        : null,
            }}
        />
    )
}
