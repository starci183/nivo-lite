import { useLoyaltyCommand, loyaltyReadOf, type LoyaltyPanelActivation } from "@/hooks/loyalty"
import { mutate } from "@/modules/viewer-cache"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    QUERY_LOYALTY_BOARD_SWR_KEY,
    useMutateDecideWorkItemSwr,
    useQueryWorkItemsSwr,
    QUERY_WORK_ITEMS_SWR_KEY,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import type { LoyaltyPendingItem } from "./loyaltyPending.shared"
import { useFeatureReset } from "@/hooks/reuseables"
import type { SWRResponse } from "swr"

/** Most waiting items one read asks for. */
const PAGE = 100

/** The view `useLoyaltyPending` returns. */
export interface LoyaltyPendingViewShape {
    read: SWRResponse<
        {
            items: Array<{
                action: string
                assigned_staff_id: string | null
                chain_id: string | null
                completed_at: string | null
                created_at: string
                decided_path: string | null
                department: string
                depth: number
                error: string | null
                evidence_state: string
                execution_id: string | null
                id: string
                inbound_event_id: string | null
                installation_id: string | null
                lead_id: string | null
                missing_fields: Array<string>
                parent_id: string | null
                reason: string | null
                reasons: Array<string>
                status: string
                subject_id: string | null
                subject_type: string
                updated_at: string
                workspace_id: string
                proposal: {
                    amount_vnd: number | null
                    confidence: number | null
                    draft: string | null
                    fields: unknown
                    outcome: string | null
                    summary: string
                    candidates: Array<{
                        amount_vnd: number
                        id: string
                        label: string
                    }> | null
                }
                result: {
                    href: string | null
                    summary: string
                } | null
            }>
            next: {
                createdAt: string
                id: string
            } | null
        },
        Error
    >
    isPending: boolean
    busy: {
        readonly id: string
        readonly decision: "approved" | "rejected"
    } | null
    editingId: string | null
    draftOf: (item: LoyaltyPendingItem) => string
    setDraft: (id: string, value: string) => void
    toggleEdit: (id: string) => void
    approve: (item: LoyaltyPendingItem) => void
    reject: (item: LoyaltyPendingItem) => void
}

/** The loyalty decisions waiting for a person: the list, the offer text being edited, and approve / reject through the same gate as everywhere. */
export const useLoyaltyPending = (activation: LoyaltyPanelActivation): LoyaltyPendingViewShape => {
    const t = useTranslations("loyalty")
    const command = useLoyaltyCommand(activation)
    const withToast = useGraphQLWithToast()
    const query = useQueryWorkItemsSwr(activation.isActive ? { statuses: ["waiting_decision"], limit: PAGE } : null)
    const decide = useMutateDecideWorkItemSwr()
    const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({})
    const [editingId, setEditingId] = useState<string | null>(null)
    const [busy, setBusy] = useState<{ readonly id: string; readonly decision: "approved" | "rejected" } | null>(null)
    useFeatureReset({
        ...activation,
        onReset: () => {
            setDrafts({})
            setEditingId(null)
            setBusy(null)
        },
    })

    const draftOf = (item: LoyaltyPendingItem): string => drafts[item.id] ?? item.draft

    const onDecide = (item: LoyaltyPendingItem, decision: "approved" | "rejected") => {
        if (!activation.isActive) return
        command.dispatch(async (isCurrent) => {
            setBusy({ id: item.id, decision })
            try {
                const text = draftOf(item).trim()
                const edited =
                    decision === "approved" && item.action === "send_promo" && text !== "" && text !== item.draft
                const answer = await withToast(
                    () =>
                        decide.trigger({
                            workItemId: item.id,
                            decision,
                            ...(edited ? { edits: { draft: text } } : {}),
                        }),
                    { successMessage: t("saved") },
                )
                if (answer === undefined) return
                if (isCurrent()) setEditingId(null)
                await Promise.all([
                    mutate(loyaltyReadOf(activation.workspaceId, [QUERY_WORK_ITEMS_SWR_KEY])),
                    mutate(loyaltyReadOf(activation.workspaceId, [QUERY_LOYALTY_BOARD_SWR_KEY])),
                ])
            } finally {
                if (isCurrent()) setBusy(null)
            }
        })
    }

    return {
        read: query,
        isPending: command.isPending,
        busy,
        editingId,
        draftOf,
        setDraft: (id: string, value: string) => setDrafts((before) => ({ ...before, [id]: value })),
        toggleEdit: (id: string) => setEditingId((before) => (before === id ? null : id)),
        approve: (item: LoyaltyPendingItem) => onDecide(item, "approved"),
        reject: (item: LoyaltyPendingItem) => onDecide(item, "rejected"),
    }
}
