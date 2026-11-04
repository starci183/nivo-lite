import { useTranslations } from "next-intl"
import type { LoyaltyPanelActivation } from "@/hooks/loyalty"
import { useQueryLoyaltyMemberSwr } from "@/hooks/swr"
import type { LoyaltyBoardType } from "@/hooks/swr"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { toast } from "@/modules/toast"
import { useMemberDetailAtoms } from "./useMemberDetailAtoms"
import { useMemberActions } from "./useMemberActions"
import { useMemberDetailForms } from "./useMemberDetailForms"
import { useMemberDetailLists } from "./useMemberDetailLists"
import type { DataSlot, SlotLabels } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"

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
    const data = useMemberDetailAtoms(read.data, { board, forms, lists })
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
