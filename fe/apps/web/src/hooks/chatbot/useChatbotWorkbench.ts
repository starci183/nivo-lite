"use client"

import { useTranslations } from "next-intl"
import { useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { agentHref } from "@/modules/installations"
import { chatbotFiguresOf } from "@/modules/chatbot"
import { useChatbotOverview } from "./useChatbotOverview"
import type { ChatbotOverviewView } from "./useChatbotOverview"
import type { ChatbotOverview, WorkbenchFigureData } from "@/modules/types"

/** How many waiting conversations the "waiting for you" card lists. */
const WAITING_ROWS = 5

/** The view `useChatbotWorkbench` returns. */
export interface ChatbotWorkbenchView {
    reads: (ReturnType<typeof useQueryMyWorkspacesSwr> | ChatbotOverviewView)[]
    workspaceId: string | undefined
    isLoading: boolean
    isFailed: boolean
    overview: ChatbotOverview | undefined
    selectedId: string | null
    userName: string
    userId: string
    canFillGaps: boolean
    figures: readonly WorkbenchFigureData[]
    /** The conversations waiting for a person, each leading to the inbox opened on it. */
    waiting: {
        total: number
        rows: {
            id: string
            title: string
            description: string
            href: string
        }[]
    }
    failure: {
        title: string
        description: string
        retryLabel: string
    } | null
    reload: () => void
}

/** One Chatbot instance as its workbench panels read it: inbox snapshot, figures, waiting conversations and who is looking. */
export const useChatbotWorkbench = (
    installationId: string | null,
    focus: string | null,
    isActive = true,
): ChatbotWorkbenchView => {
    const t = useTranslations("workbenchChatbot")
    const frame = useTranslations("agentDashboard")
    const { activeWorkspaceId } = useActiveWorkspace()
    const memberships = useQueryMyWorkspacesSwr()
    const member = memberships.data?.find((membership) => membership.workspace.id === activeWorkspaceId)?.member
    const overview = useChatbotOverview(isActive ? activeWorkspaceId : undefined, installationId ?? undefined)
    const isLoading = activeWorkspaceId === undefined || overview.isLoading || memberships.isLoading
    const selected = overview.data?.conversations.find((item) => item.id === focus) ?? overview.data?.conversations[0]
    const isFailed = overview.error !== undefined || memberships.error !== undefined
    return {
        reads: [overview, memberships],
        workspaceId: activeWorkspaceId,
        isLoading,
        isFailed,
        overview: overview.data,
        selectedId: selected?.id ?? null,
        userName: member?.displayName ?? "",
        userId: member?.userId ?? "",
        canFillGaps: member?.role === "owner" || member?.role === "manager",
        figures: chatbotFiguresOf(t, overview.data?.metrics, overview.data?.conversations),
        /** The conversations waiting for a person, each leading to the inbox opened on it. */
        waiting: {
            total: overview.data?.metrics.waiting ?? 0,
            rows: (overview.data?.conversations ?? [])
                .filter((item) => item.waiting)
                .slice(0, WAITING_ROWS)
                .map((item) => ({
                    id: item.id,
                    title: item.name,
                    description: item.lastText,
                    href: agentHref(
                        "chatbot",
                        installationId,
                        "workbench",
                        new URLSearchParams({ focus: item.id }).toString(),
                    ),
                })),
        },
        failure: isFailed
            ? { title: frame("regionFailed"), description: t("loadError"), retryLabel: t("reload") }
            : null,
        reload: () => {
            void Promise.allSettled([overview.mutate(), memberships.mutate()])
        },
    }
}
