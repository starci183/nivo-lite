"use client"

import { EMPTY_LOYALTY_BOARD, daysSince } from "@/hooks/loyalty"
import { useQueryLoyaltyBoardSwr } from "@/hooks/swr"
import { useFormatter, useTranslations } from "next-intl"
import { useLoyaltyPending } from "@/hooks/loyaltyPending"
import { canDecideItem, useMember } from "@/hooks/member"
import { LoyaltyPendingBase } from "./component"

/** The connected pending tab: the loyalty decisions (points, rewards, offers) waiting for a person, decided through `decideWorkItem` with the outcome toasted. */
/** The connected Pending tab: reads the loyalty board itself (SWR shares the one request with the other tabs). */
export const LoyaltyPending = () => {
    const { data } = useQueryLoyaltyBoardSwr()
    const board = data ?? EMPTY_LOYALTY_BOARD
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const me = useMember()
    const pending = useLoyaltyPending()
    const money = (value: number) =>
        format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    return (
        <LoyaltyPendingBase
            props={{
                label: t("tab_pending"),
                emptyTitle: t("pendingEmptyTitle"),
                emptyBody: t("pendingEmptyBody"),
                draftLabel: t("draftLabel"),
                draftHint: t("draftEditHint"),
                waitingManager: t("waitingManager"),
                approve: t("approve"),
                reject: t("reject"),
                edit: t("edit"),
                editDone: t("editDone"),
                isPending: pending.isPending,
                rows: pending.items.map((item) => {
                    const age = daysSince(item.createdAt, board.nowIso)
                    const isPromo = item.action === "send_promo"
                    return {
                        id: item.id,
                        actionLabel: t(`action_${item.action}`),
                        age:
                            age === 0
                                ? format.dateTime(new Date(item.createdAt), {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hourCycle: "h23",
                                  })
                                : t("daysAgo", { n: age }),
                        customer: item.customer,
                        summary: item.summary,
                        reason:
                            item.reason === null || item.reason === ""
                                ? ""
                                : t("pendingReason", { reason: item.reason }),
                        value:
                            item.action === "redeem_reward" && item.amountVnd !== null
                                ? t("pendingValue", { value: money(item.amountVnd) })
                                : "",
                        draft: isPromo ? pending.draftOf(item) : item.draft,
                        canAct: canDecideItem(me, item.assignedStaffId),
                        canEditDraft: isPromo,
                        isEditing: pending.editingId === item.id,
                        isApproving: pending.busy?.id === item.id && pending.busy.decision === "approved",
                        isRejecting: pending.busy?.id === item.id && pending.busy.decision === "rejected",
                    }
                }),
            }}
            on={{
                approve: (id) => {
                    const item = pending.items.find((candidate) => candidate.id === id)
                    if (item !== undefined) pending.approve(item)
                },
                reject: (id) => {
                    const item = pending.items.find((candidate) => candidate.id === id)
                    if (item !== undefined) pending.reject(item)
                },
                toggleEdit: pending.toggleEdit,
                setDraft: pending.setDraft,
            }}
        />
    )
}
