"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useSWRConfig } from "swr"
import {
    isQueryLoyaltyBoardSwrKey,
    isQueryWorkItemsSwrKey,
    useMutateDecideWorkItemSwr,
    useQueryWorkItemsSwr,
} from "@/hooks/swr/api/graphql"
import { useGraphQLWithToast } from "@/modules/toast"
import { pendingOf } from "./loyaltyPending.shared"
import type { LoyaltyPendingItem } from "./loyaltyPending.shared"

/** Most waiting items one read asks for. */
const PAGE = 100

/** The loyalty decisions waiting for a person: the list, the offer text being edited, and approve / reject through the same gate as everywhere. */
export const useLoyaltyPending = () => {
    const t = useTranslations("loyalty")
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const query = useQueryWorkItemsSwr({ statuses: ["waiting_decision"], limit: PAGE })
    const decide = useMutateDecideWorkItemSwr()
    const [isPending, startTransition] = useTransition()
    const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({})
    const [editingId, setEditingId] = useState<string | null>(null)
    const [busy, setBusy] = useState<{ readonly id: string; readonly decision: "approved" | "rejected" } | null>(null)

    const items = pendingOf(query.data?.items ?? [])
    const draftOf = (item: LoyaltyPendingItem): string => drafts[item.id] ?? item.draft

    const onDecide = (item: LoyaltyPendingItem, decision: "approved" | "rejected") =>
        startTransition(async () => {
            setBusy({ id: item.id, decision })
            const text = draftOf(item).trim()
            const edited = decision === "approved" && item.action === "send_promo" && text !== "" && text !== item.draft
            const answer = await withToast(
                () =>
                    decide.trigger({
                        workItemId: item.id,
                        decision,
                        ...(edited ? { edits: { draft: text } } : {}),
                    }),
                { successMessage: t("saved") },
            )
            setBusy(null)
            if (answer === undefined) return
            setEditingId(null)
            void mutate(isQueryWorkItemsSwrKey)
            void mutate(isQueryLoyaltyBoardSwrKey)
        })

    return {
        items,
        isLoading: query.isLoading,
        isPending,
        busy,
        editingId,
        draftOf,
        setDraft: (id: string, value: string) => setDrafts((before) => ({ ...before, [id]: value })),
        toggleEdit: (id: string) => setEditingId((before) => (before === id ? null : id)),
        approve: (item: LoyaltyPendingItem) => onDecide(item, "approved"),
        reject: (item: LoyaltyPendingItem) => onDecide(item, "rejected"),
    }
}
