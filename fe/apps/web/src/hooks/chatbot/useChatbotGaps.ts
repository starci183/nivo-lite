"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useCallback } from "react"
import { useSWRConfig } from "swr"
import { slotOfSwr } from "@/hooks/slot"
import {
    QUERY_AGENT_DASHBOARD_SWR_KEY,
    QUERY_CHATBOT_GAPS_SWR_KEY,
    useMutateChatbotDismissKnowledgeGapSwr,
    useQueryChatbotGapsSwr,
} from "@/hooks/swr"
import { brainTabHref } from "@/modules/routes"
import { useGraphQLWithToast } from "@/modules/toast"

/** One unanswered question, already worded. */
interface ChatbotGapRow {
    readonly id: string
    readonly title: string
    readonly line: string
    readonly badges: ReadonlyArray<{ readonly label: string; readonly tone: "neutral" | "warning" }>
    readonly answerLabel: string
    readonly answerHref: string
    readonly dismissLabel: string
}

/** Reads the open gaps of a manager and dismisses a gap through its GraphQL mutation. Without a manager the card is `null`. */
export const useChatbotGaps = (workspaceId: string | undefined, isManager: boolean) => {
    const t = useTranslations("brain")
    const format = useFormatter()
    const runGraphQL = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const query = useQueryChatbotGapsSwr(isManager ? workspaceId : undefined)
    const mutation = useMutateChatbotDismissKnowledgeGapSwr()
    const dismiss = useCallback(
        async (id: string) => {
            const result = await runGraphQL(() => mutation.trigger({ id }), { successMessage: t("gapDismissed") })
            if (result === undefined) return
            await Promise.allSettled([
                mutate([QUERY_CHATBOT_GAPS_SWR_KEY, workspaceId]),
                mutate(
                    (key) => Array.isArray(key) && key[0] === QUERY_AGENT_DASHBOARD_SWR_KEY && key[1] === workspaceId,
                ),
            ])
        },
        [mutate, mutation, runGraphQL, t, workspaceId],
    )
    const reload = useCallback(() => {
        void query.mutate()
    }, [query])
    const rows = query.data?.gaps.map((gap): ChatbotGapRow => {
        const when = format.dateTime(new Date(gap.lastSeenAt), { dateStyle: "medium" })
        return {
            id: gap.id,
            title: gap.question,
            line: gap.count > 1 ? t("gapAsked", { n: gap.count, when }) : t("gapAskedOnce", { when }),
            badges: [
                { label: gap.module, tone: "neutral" },
                ...(gap.reopenedCount > 0 ? [{ label: t("gapReopened"), tone: "warning" as const }] : []),
            ],
            answerLabel: t("gapAnswer"),
            answerHref: brainTabHref("gaps", { answer: gap.id }),
            dismissLabel: t("gapDismiss"),
        }
    })
    return {
        slot: slotOfSwr({ data: rows, error: query.error, isLoading: query.isLoading }),
        title: t("gapsTitle"),
        description: t("gapsIntro"),
        emptyTitle: t("gapsEmpty"),
        isPending: mutation.isMutating,
        dismiss,
        reload,
    }
}
