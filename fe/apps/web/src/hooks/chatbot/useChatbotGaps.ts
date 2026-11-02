"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { useFeatureLifetime } from "@/hooks/reuseables"
import { useSWRConfig } from "swr"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import type { ChatbotGapRow } from "./chatbot.shared"
import {
    QUERY_AGENT_DASHBOARD_SWR_KEY,
    QUERY_CHATBOT_GAPS_SWR_KEY,
    useMutateChatbotDismissKnowledgeGapSwr,
    useQueryChatbotGapsSwr,
} from "@/hooks/swr"
import { maskPhones } from "@/modules/utils"
import { brainTabHref } from "@/modules/routes"
import { useGraphQLWithToast } from "@/modules/toast"

/** Reads the open gaps of a manager and dismisses a gap through its GraphQL mutation. Without a manager the card is `null`. */
export const useChatbotGaps = (
    workspaceId: string | undefined,
    isManager: boolean,
    isActive = true,
    scope = workspaceId ?? "",
) => {
    const t = useTranslations("brain")
    const format = useFormatter()
    const runGraphQL = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const query = useQueryChatbotGapsSwr(isActive && isManager ? workspaceId : undefined)
    const mutation = useMutateChatbotDismissKnowledgeGapSwr()
    const lifetime = useFeatureLifetime(isActive && workspaceId !== undefined, scope)
    const [operation, setOperation] = useState<{ readonly scope: string; readonly isCurrent: () => boolean } | null>(
        null,
    )
    const dismiss = useCallback(
        async (id: string) => {
            const pending = { scope, isCurrent: lifetime.capture() }
            if (!pending.isCurrent()) return
            setOperation(pending)
            const result = await runGraphQL(() => mutation.trigger({ id }), {
                successMessage: t("gapDismissed"),
            }).finally(() => setOperation((current) => (current === pending ? null : current)))
            if (result === undefined) return
            await Promise.allSettled([
                mutate([QUERY_CHATBOT_GAPS_SWR_KEY, workspaceId]),
                mutate(
                    (key) => Array.isArray(key) && key[0] === QUERY_AGENT_DASHBOARD_SWR_KEY && key[1] === workspaceId,
                ),
            ])
        },
        [lifetime, mutate, mutation, runGraphQL, scope, t, workspaceId],
    )
    const reload = useCallback(() => {
        void query.mutate()
    }, [query])
    return {
        slot: mapSlot(slotOfSwr(query), (data) => data.gaps.map((gap) => gapViewOf(gap, t, format))),
        title: t("gapsTitle"),
        description: t("gapsIntro"),
        emptyTitle: t("gapsEmpty"),
        isPending: operation?.scope === scope && operation.isCurrent(),
        dismiss,
        reload,
    }
}

/** Resolves one actual unanswered question without replacing its read's status. */
const gapViewOf = (
    gap: NonNullable<ReturnType<typeof useQueryChatbotGapsSwr>["data"]>["gaps"][number],
    t: ReturnType<typeof useTranslations<"brain">>,
    format: ReturnType<typeof useFormatter>,
): ChatbotGapRow => {
    const when = format.dateTime(new Date(gap.lastSeenAt), { dateStyle: "medium" })
    return {
        id: gap.id,
        title: maskPhones(gap.question),
        line: gap.count > 1 ? t("gapAsked", { n: gap.count, when }) : t("gapAskedOnce", { when }),
        badges: gap.reopenedCount > 0 ? [{ label: t("gapReopened"), tone: "warning" }] : [],
        answerLabel: t("gapAnswer"),
        answerHref: brainTabHref("todo", { answer: gap.id }),
        dismissLabel: t("gapDismiss"),
    }
}
