"use client"

import { useTranslations } from "next-intl"
import { useState, useSyncExternalStore, useTransition } from "react"
import { useSWRConfig } from "swr"
import { QUERY_LOYALTY_BOARD_SWR_KEY, useMutateSyncLoyaltyMembersSwr } from "@/hooks/swr"
import { matchesSwrKey } from "@/modules/utils"
import { useGraphQLWithToast } from "@/modules/toast"

const unsubscribe = (): void => undefined
const noSubscription = () => unsubscribe
const browserOrigin = () => window.location.origin
const serverOrigin = () => ""

/** The overview's actions: sync customers into members, and the public check link with its copied flag. */
export const useOverviewActions = (slug: string) => {
    const t = useTranslations("loyalty")
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const syncMembers = useMutateSyncLoyaltyMembersSwr()
    const [isPending, startTransition] = useTransition()
    const origin = useSyncExternalStore(noSubscription, browserOrigin, serverOrigin)
    const [copied, setCopied] = useState(false)
    const [syncNote, setSyncNote] = useState<string | null>(null)
    return {
        isPending,
        copied,
        syncNote,
        url: `${origin}/l/${slug}`,
        markCopied: () => setCopied(true),
        sync: () =>
            startTransition(async () => {
                setSyncNote(null)
                const answer = await withToast(() => syncMembers.trigger(), { showSuccessToast: false })
                if (answer === undefined) return
                setSyncNote(t("syncDone", { created: answer.created, linked: answer.linked }))
                void mutate(matchesSwrKey(QUERY_LOYALTY_BOARD_SWR_KEY))
            }),
    }
}
