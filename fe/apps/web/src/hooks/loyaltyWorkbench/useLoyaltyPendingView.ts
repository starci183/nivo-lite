import { toast } from "@/modules/toast"

import { daysSince, type LoyaltyPanelInput } from "@/hooks/loyalty"
import { slotOfReads, useSlotLabels } from "@/hooks/slot"
import { useFormatter, useTranslations } from "next-intl"
import { pendingOf, useLoyaltyPending } from "@/hooks/loyaltyPending"
import { canDecideItem, useMember } from "@/hooks/member"

/** The connected pending tab: the loyalty decisions (points, rewards, offers) waiting for a person, decided through `decideWorkItem` with the outcome toasted. */
/** The connected Pending tab: reads the loyalty board itself (SWR shares the one request with the other tabs). */
export const useLoyaltyPendingView = (input: LoyaltyPanelInput) => {
    const read = input.read
    const slotLabels = useSlotLabels()
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const me = useMember()
    const pending = useLoyaltyPending(input)
    const retry = () => {
        Promise.all([input.read.mutate(), pending.read.mutate()]).catch(() => toast.danger(slotLabels("").error))
    }
    const money = (value: number) =>
        format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const view = {
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
    }
    const items = pending.read.data === undefined ? undefined : pendingOf(pending.read.data.items)
    return {
        props: {
            slot: slotOfReads([read, pending.read], () => {
                const board = read.data
                const work = pending.read.data
                if (board === undefined || work === undefined) return undefined
                return { rows: pendingRowsOf({ items: pendingOf(work.items), pending, board, t, format, money, me }) }
            }),
            labels: slotLabels(t("pendingEmptyTitle")),
            copy: view,
        },
        on: {
            approve: (id: string) => {
                const item = items?.find((candidate) => candidate.id === id)
                if (item !== undefined) pending.approve(item)
            },
            reject: (id: string) => {
                const item = items?.find((candidate) => candidate.id === id)
                if (item !== undefined) pending.reject(item)
            },
            toggleEdit: pending.toggleEdit,
            setDraft: pending.setDraft,
            retry: retry,
        },
    }
}

interface PendingRowsContext {
    readonly pending: ReturnType<typeof useLoyaltyPending>
    readonly board: NonNullable<LoyaltyPanelInput["read"]["data"]>
    readonly items: ReturnType<typeof pendingOf>
    readonly t: ReturnType<typeof useTranslations<"loyalty">>
    readonly format: ReturnType<typeof useFormatter>
    readonly money: (value: number) => string
    readonly me: ReturnType<typeof useMember>
}

/** The actual waiting work items, worded with their board clock and existing decision authority. */
const pendingRowsOf = ({ items, pending, board, t, format, money, me }: PendingRowsContext) =>
    items.map((item) => {
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
            reason: item.reason === null || item.reason === "" ? "" : t("pendingReason", { reason: item.reason }),
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
    })
