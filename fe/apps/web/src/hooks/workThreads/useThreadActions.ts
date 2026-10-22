"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import {
    useMutateCreateWorkThreadSwr,
    useMutateDecideThreadApprovalSwr,
    useMutatePostThreadMessageSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { mentionsToSend } from "@/modules/work-threads"
import type { PickedMention } from "@/modules/work-threads"

/** What a thread write needs to know: the open thread and what to read again once something changed. */
interface ThreadActionTarget {
    readonly threadId: string | null
    readonly reload: () => void
    readonly opened: (threadId: string) => void
}

/** The writes of the work threads board: open a thread, write in it with the tags picked, decide an approval card. Each one reads the board again. */
export const useThreadActions = (target: ThreadActionTarget) => {
    const t = useTranslations("workThreads")
    const runGraphQL = useGraphQLWithToast()
    const create = useMutateCreateWorkThreadSwr()
    const post = useMutatePostThreadMessageSwr()
    const decide = useMutateDecideThreadApprovalSwr()
    const [isDeciding, setIsDeciding] = useState<string | null>(null)

    const open = useCallback(
        async (title: string): Promise<boolean> => {
            const made = await runGraphQL(() => create.trigger({ title }), { successMessage: t("threadOpened") })
            if (made === undefined) return false
            target.reload()
            target.opened(made.id)
            return true
        },
        [create, runGraphQL, t, target],
    )

    const send = useCallback(
        async (draft: string, picked: ReadonlyArray<PickedMention>): Promise<boolean> => {
            if (target.threadId === null) return false
            const threadId = target.threadId
            const sent = await runGraphQL(
                () =>
                    post.trigger({
                        threadId,
                        body: draft.trim(),
                        mentions: [...mentionsToSend(draft, picked)],
                        quoted: [],
                    }),
                { successMessage: t("messageSent") },
            )
            if (sent === undefined) return false
            target.reload()
            return true
        },
        [post, runGraphQL, t, target],
    )

    const decideCard = useCallback(
        async (messageId: string, verdict: "approve" | "reject"): Promise<void> => {
            setIsDeciding(messageId)
            const decided = await runGraphQL(() => decide.trigger({ messageId, verdict }), {
                successMessage: t("decisionSucceeded"),
            })
            setIsDeciding(null)
            if (decided !== undefined) target.reload()
        },
        [decide, runGraphQL, t, target],
    )

    return { open, send, decideCard, isOpening: create.isMutating, isSending: post.isMutating, decidingId: isDeciding }
}
