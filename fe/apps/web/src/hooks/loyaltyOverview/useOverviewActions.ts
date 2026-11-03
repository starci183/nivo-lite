import { useLoyaltyCommand, loyaltyReadOf, type LoyaltyPanelActivation } from "@/hooks/loyalty"
import { mutate } from "@/modules/viewer-cache"

import { useTranslations } from "next-intl"
import { useState, useSyncExternalStore } from "react"
import { QUERY_LOYALTY_BOARD_SWR_KEY, useMutateSyncLoyaltyMembersSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { useFeatureReset } from "@/hooks/reuseables"

const unsubscribe = (): void => undefined
const noSubscription = () => unsubscribe
const browserOrigin = () => window.location.origin
const serverOrigin = () => ""

/** The view `useOverviewActions` returns. */
export interface OverviewActionsView {
    isPending: boolean
    copied: boolean
    syncNote: string | null
    url: string
    markCopied: () => void
    sync: () => void
}

/** The overview's actions: sync customers into members, and the public check link with its copied flag. */
export const useOverviewActions = (slug: string, activation: LoyaltyPanelActivation): OverviewActionsView => {
    const { isActive } = activation
    const t = useTranslations("loyalty")
    const command = useLoyaltyCommand(activation)
    const withToast = useGraphQLWithToast()
    const syncMembers = useMutateSyncLoyaltyMembersSwr()
    const origin = useSyncExternalStore(noSubscription, browserOrigin, serverOrigin)
    const [copied, setCopied] = useState(false)
    const [syncNote, setSyncNote] = useState<string | null>(null)
    useFeatureReset({
        ...activation,
        onReset: () => {
            setCopied(false)
            setSyncNote(null)
        },
    })
    return {
        isPending: command.isPending,
        copied,
        syncNote,
        url: `${origin}/l/${slug}`,
        markCopied: () => {
            if (command.isCurrent()) setCopied(true)
        },
        sync: () => {
            if (!isActive) return
            command.dispatch(async (isCurrent) => {
                setSyncNote(null)
                const answer = await withToast(() => syncMembers.trigger(), { showSuccessToast: false })
                if (answer === undefined) return
                if (isCurrent()) setSyncNote(t("syncDone", { created: answer.created, linked: answer.linked }))
                await mutate(loyaltyReadOf(activation.workspaceId, [QUERY_LOYALTY_BOARD_SWR_KEY]))
            })
        },
    }
}
