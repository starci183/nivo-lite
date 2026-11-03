import { useFormatter, useTranslations } from "next-intl"
import { tierTone } from "@/hooks/loyalty"
import type { LoyaltyPanelActivation } from "@/hooks/loyalty"
import { useQueryLoyaltyMemberSwr } from "@/hooks/swr"
import type { LoyaltyBoardType } from "@/hooks/swr"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { toast } from "@/modules/toast"
import { groupPhone } from "./loyaltyMembers.shared"
import { useMemberActions } from "./useMemberActions"
import { useMemberDetailForms } from "./useMemberDetailForms"
import { useMemberDetailLists } from "./useMemberDetailLists"
import type { DataSlot, SlotLabels } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"

const TIME_ZONE = "Asia/Ho_Chi_Minh"
type MemberDetail = NonNullable<ReturnType<typeof useQueryLoyaltyMemberSwr>["data"]>

interface MemberWords {
    readonly board: LoyaltyBoardType
    readonly forms: ReturnType<typeof useMemberDetailForms>
    readonly lists: ReturnType<typeof useMemberDetailLists>
    readonly t: ReturnType<typeof useTranslations<"loyalty">>
    readonly format: ReturnType<typeof useFormatter>
}

/** Resolves member atoms; an unresolved record supplies copy and empty values, never a ready slot. */
const memberViewOf = (data: MemberDetail | undefined, words: MemberWords) => {
    const { board, forms, lists, t, format } = words
    const member = data?.member
    const money = (value: number) =>
        format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const points = (value: number) => t("points", { n: format.number(value) })
    const date = (iso: string) =>
        format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TIME_ZONE })
    return {
        name: member?.name ?? "",
        closeLabel: t("close"),
        ...(data === undefined || data.tierName === ""
            ? {}
            : { tier: { name: data.tierName, tone: tierTone(board.config, member?.tierKey ?? null) } }),
        points: points(member?.points ?? 0),
        contact:
            [groupPhone(member?.phone), member?.email ?? ""].filter((part) => part !== "").join(" · ") || t("noPhone"),
        spentLine: `${t("spentTotal", { value: money(member?.lifetimeSpendVnd ?? 0) })} · ${t("visitsCount", { n: member?.visits ?? 0 })}`,
        joinedLine: member === undefined ? "" : t("joinedAt", { date: date(member.joinedAt) }),
        nextTierLine:
            data?.nextTier === undefined || data.nextTier === null
                ? t("topTier")
                : t("nextTier", { name: data.nextTier.tier.name, value: money(data.nextTier.missingVnd) }),
        ...(data !== undefined && data.expiring.points > 0
            ? {
                  expiringLine: t("expiringSoon", {
                      points: points(data.expiring.points),
                      date: data.expiring.firstAt === null ? "" : date(data.expiring.firstAt),
                  }),
              }
            : {}),
        editTitle: t("editTitle"),
        ...(forms.edit === undefined ? {} : { edit: forms.edit }),
        ...(forms.readOnly === undefined ? {} : { readOnly: forms.readOnly }),
        adjustTitle: t("adjustTitle"),
        adjustBody: t("adjustBody"),
        adjust: forms.adjust,
        rewards: lists.rewards,
        ledger: lists.ledger,
        asOf: t("asOf", {
            date: format.dateTime(new Date(board.nowIso), {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: TIME_ZONE,
            }),
        }),
    }
}

/** The view `useMemberDetailView` returns. */
export interface MemberDetailView {
    props: {
        slot: DataSlot<{
            identity: {
                asOf: string
                expiringLine?: string
                points: string
                contact: string
                spentLine: string
                joinedLine: string
                nextTierLine: string
                tier?: {
                    name: string
                    tone: BadgeTone
                }
                name: string
            }
            rewardRows: {
                note?: string
                blocked?: string
                id: string
                name: string
                cost: string
            }[]
            ledgerRows: {
                evidence?: string
                ref?: string
                dateTime: string
                timeLabel: string
                amount?: string
                id: string
                kind: string
                tone: BadgeTone
                points: string
            }[]
        }>
        labels: SlotLabels
        copy: {
            adjustTitle: string
            adjustBody: string
            adjust: {
                isPending: boolean
                note?: string
                canSubmit: boolean
                pointsLabel: string
                pointsHint: string
                pointsPlaceholder: string
                reasonLabel: string
                submitLabel: string
                pointsError?: string
                label: string
                memberId: string
                points: string
                reason: string
            }
            rewards: {
                title: string
                emptyText: string
                redeemLabel: string
                busyId: string | null
            }
            ledger: {
                title: string
                emptyText: string
            }
            readOnly?: {
                items: {
                    id: string
                    term: string
                    description: string
                }[]
                note: string
            }
            edit?: {
                noteMax: number
                saveLabel: string
                isPending: boolean
                nameLabel: string
                birthdayLabel: string
                birthdayPlaceholder: string
                birthdayHint: string
                noteLabel: string
                birthdayError?: string
                nameError?: string
                label: string
                memberId: string
                name: string
                birthday: string
                note: string
            }
            closeLabel: string
            editTitle: string
        }
    }
    on: {
        redeem: (rewardId: string) => void
        retry: () => void
        edit: {
            onName: (text: string) => void
            onBirthday: (text: string) => void
            onNote: (text: string) => void
            onSubmit: () => void
        }
        adjust: {
            onPoints: (text: string) => void
            onReason: (text: string) => void
            onSubmit: () => void
        }
    }
    clear: () => void
}

/** Owns the selected member's real read, retry and forms; the module Base owns its independent SlotView. */
export const useMemberDetailView = (
    board: LoyaltyBoardType,
    customerId: string | null,
    activation: LoyaltyPanelActivation,
): MemberDetailView => {
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const read = useQueryLoyaltyMemberSwr(
        activation.isActive && activation.isReady && customerId !== null ? { customerId } : null,
    )
    const selected = {
        ...activation,
        isActive: activation.isActive && customerId !== null,
        isReady: read.data !== undefined,
        scope: JSON.stringify([activation.scope, customerId]),
    }
    const actions = useMemberActions(customerId ?? "", selected)
    const forms = useMemberDetailForms({
        memberId: customerId ?? "",
        member: read.data?.member,
        canManage: board.canManage,
        actions,
        activation: selected,
    })
    const lists = useMemberDetailLists(read.data, actions)
    const data = memberViewOf(read.data, { board, forms, lists, t, format })
    const labels = slotLabels(t("detailEmptyTitle"))
    const { rewards, ledger, closeLabel, editTitle, edit, readOnly, adjustTitle, adjustBody, adjust, ...identity } =
        data
    const { rows: rewardRows, ...rewardCopy } = rewards
    const { rows: ledgerRows, ...ledgerCopy } = ledger
    return {
        props: {
            slot: mapSlot(slotOfSwr(read), () => ({ identity, rewardRows, ledgerRows })),
            labels,
            copy: {
                closeLabel,
                editTitle,
                ...(edit === undefined ? {} : { edit }),
                ...(readOnly === undefined ? {} : { readOnly }),
                adjustTitle,
                adjustBody,
                adjust,
                rewards: rewardCopy,
                ledger: ledgerCopy,
            },
        },
        on: {
            ...forms.on,
            redeem: actions.redeem,
            retry: () => {
                read.mutate().catch(() => toast.danger(labels.error))
            },
        },
        clear: () => {
            actions.clear()
            forms.reset()
        },
    }
}
