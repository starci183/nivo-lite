"use client"

import { useSlotLabels } from "@/hooks/slot"
import { toast } from "@/modules/toast"
import { EMPTY_LOYALTY_BOARD, type LoyaltyPanelInput } from "./loyalty.shared"
import type { SWRResponse } from "swr"
import type { SlotLabels } from "@/modules/types"

/** The view `useLoyaltyPanelBoard` returns. */
export interface LoyaltyPanelBoardView {
    read: SWRResponse<{
        canManage: boolean
        nowIso: string
        campaigns: Array<{
            createdAt: string
            createdBy: string
            draft: string
            draftMs: number | null
            errorCode: string | null
            failed: number
            finishedAt: string | null
            id: string
            messageDraft: string
            name: string
            queued: number
            recipients: number
            sent: number
            skipped: number
            status: string
            workItemId: string | null
            segment: {
                birthdayThisMonth: boolean
                inactiveDays: number
                minSpendVnd: number
                tiers: Array<string>
            }
        }>
        config: {
            birthday: {
                enabled: boolean
                note: string
                points: number
                rewardKey: string
            }
            earn: {
                minOrderVnd: number
                perThousandVnd: number
                perVisit: number
                trigger: string
                categories: Array<{
                    label: string
                    match: string
                    perThousandVnd: number
                }>
            }
            expiry: {
                months: number
                warnDays: number
            }
            promo: {
                batch: number
                hourFrom: string
                hourTo: string
                maxPerMonth: number
            }
            tiers: Array<{
                benefit: string
                key: string
                minSpendVnd: number
                multiplier: number
                name: string
                winbackDays: number
            }>
        }
        figures: {
            activeMembers: number
            atRisk: number
            members: number
            pointsIssued30d: number
            pointsRedeemed30d: number
            redemptions30d: number
        }
        members: Array<{
            birthday: string | null
            email: string | null
            id: string
            joinedAt: string
            lastVisitAt: string | null
            lifetimeSpendVnd: number
            name: string
            note: string
            phone: string | null
            points: number
            tierKey: string | null
            visits: number
        }>
        program: {
            createdAt: string
            enabled: boolean
            name: string
            slug: string
            workspaceId: string
            config: {
                birthday: {
                    enabled: boolean
                    note: string
                    points: number
                    rewardKey: string
                }
                earn: {
                    minOrderVnd: number
                    perThousandVnd: number
                    perVisit: number
                    trigger: string
                    categories: Array<{
                        label: string
                        match: string
                        perThousandVnd: number
                    }>
                }
                expiry: {
                    months: number
                    warnDays: number
                }
                promo: {
                    batch: number
                    hourFrom: string
                    hourTo: string
                    maxPerMonth: number
                }
                tiers: Array<{
                    benefit: string
                    key: string
                    minSpendVnd: number
                    multiplier: number
                    name: string
                    winbackDays: number
                }>
            }
        } | null
        rewards: Array<{
            active: boolean
            id: string
            key: string
            kind: string
            minTierKey: string | null
            name: string
            note: string
            perCustomerLimit: number | null
            percent: number | null
            pointsCost: number
            stock: number | null
            valueVnd: number
        }>
        stats: {
            active90d: number
            birthdaysThisMonth: number
            earned30d: number
            expired30d: number
            members: number
            pointsOutstanding: number
            promosSent30d: number
            redeemed30d: number
            redemptions30d: number
            rewardValue30d: number
            spend30d: number
            tierCounts: Array<{
                count: number
                key: string
                name: string
            }>
        }
    }>
    board: {
        canManage: boolean
        nowIso: string
        campaigns: Array<{
            createdAt: string
            createdBy: string
            draft: string
            draftMs: number | null
            errorCode: string | null
            failed: number
            finishedAt: string | null
            id: string
            messageDraft: string
            name: string
            queued: number
            recipients: number
            sent: number
            skipped: number
            status: string
            workItemId: string | null
            segment: {
                birthdayThisMonth: boolean
                inactiveDays: number
                minSpendVnd: number
                tiers: Array<string>
            }
        }>
        config: {
            birthday: {
                enabled: boolean
                note: string
                points: number
                rewardKey: string
            }
            earn: {
                minOrderVnd: number
                perThousandVnd: number
                perVisit: number
                trigger: string
                categories: Array<{
                    label: string
                    match: string
                    perThousandVnd: number
                }>
            }
            expiry: {
                months: number
                warnDays: number
            }
            promo: {
                batch: number
                hourFrom: string
                hourTo: string
                maxPerMonth: number
            }
            tiers: Array<{
                benefit: string
                key: string
                minSpendVnd: number
                multiplier: number
                name: string
                winbackDays: number
            }>
        }
        figures: {
            activeMembers: number
            atRisk: number
            members: number
            pointsIssued30d: number
            pointsRedeemed30d: number
            redemptions30d: number
        }
        members: Array<{
            birthday: string | null
            email: string | null
            id: string
            joinedAt: string
            lastVisitAt: string | null
            lifetimeSpendVnd: number
            name: string
            note: string
            phone: string | null
            points: number
            tierKey: string | null
            visits: number
        }>
        program: {
            createdAt: string
            enabled: boolean
            name: string
            slug: string
            workspaceId: string
            config: {
                birthday: {
                    enabled: boolean
                    note: string
                    points: number
                    rewardKey: string
                }
                earn: {
                    minOrderVnd: number
                    perThousandVnd: number
                    perVisit: number
                    trigger: string
                    categories: Array<{
                        label: string
                        match: string
                        perThousandVnd: number
                    }>
                }
                expiry: {
                    months: number
                    warnDays: number
                }
                promo: {
                    batch: number
                    hourFrom: string
                    hourTo: string
                    maxPerMonth: number
                }
                tiers: Array<{
                    benefit: string
                    key: string
                    minSpendVnd: number
                    multiplier: number
                    name: string
                    winbackDays: number
                }>
            }
        } | null
        rewards: Array<{
            active: boolean
            id: string
            key: string
            kind: string
            minTierKey: string | null
            name: string
            note: string
            perCustomerLimit: number | null
            percent: number | null
            pointsCost: number
            stock: number | null
            valueVnd: number
        }>
        stats: {
            active90d: number
            birthdaysThisMonth: number
            earned30d: number
            expired30d: number
            members: number
            pointsOutstanding: number
            promosSent30d: number
            redeemed30d: number
            redemptions30d: number
            rewardValue30d: number
            spend30d: number
            tierCounts: Array<{
                count: number
                key: string
                name: string
            }>
        }
    }
    slotLabels: (empty: string) => SlotLabels
    retry: () => void
}

/** The board a loyalty panel reads (the empty one while it is on its way, so the placeholder is the same tree), its labels and the way to read it again. */
export const useLoyaltyPanelBoard = (input: LoyaltyPanelInput): LoyaltyPanelBoardView => {
    const slotLabels = useSlotLabels()
    const retry = () => {
        input.read.mutate().catch(() => toast.danger(slotLabels("").error))
    }
    return { read: input.read, board: input.read.data ?? EMPTY_LOYALTY_BOARD, slotLabels, retry }
}
