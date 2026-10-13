"use client"

import { useTranslations } from "next-intl"
import { useRef, useState, useTransition } from "react"
import { useSWRConfig } from "swr"
import {
    QUERY_LOYALTY_BOARD_SWR_KEY,
    QUERY_LOYALTY_MEMBER_SWR_KEY,
    useMutateAdjustLoyaltyPointsSwr,
    useMutateRedeemLoyaltyRewardSwr,
    useMutateUpdateLoyaltyMemberSwr,
} from "@/hooks/swr"
import { matchesSwrKey, newIdempotencyToken } from "@/modules/utils"
import { useGraphQLWithToast } from "@/modules/toast"

/** The outcome line shown under a reward after a redemption. */
export interface ActionNote {
    readonly id: string
    readonly text: string
}

/** The member details the form saves; the birthday is the ISO date or null. */
export interface MemberFields {
    readonly name: string
    readonly birthday: string | null
    readonly note: string
}

/** What the member page writes: details, point adjustments and redemptions, each toasted and followed by a revalidation. */
export const useMemberActions = (customerId: string) => {
    const t = useTranslations("loyalty")
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const updateMember = useMutateUpdateLoyaltyMemberSwr()
    const adjustPoints = useMutateAdjustLoyaltyPointsSwr()
    const redeemReward = useMutateRedeemLoyaltyRewardSwr()
    const adjustToken = useRef(newIdempotencyToken())
    const redeemToken = useRef(newIdempotencyToken())
    const [isPending, startTransition] = useTransition()
    const [busyReward, setBusyReward] = useState<string | null>(null)
    const [adjustNote, setAdjustNote] = useState<string | null>(null)
    const [redeemNote, setRedeemNote] = useState<ActionNote | null>(null)
    const refresh = () => {
        void mutate(matchesSwrKey(QUERY_LOYALTY_BOARD_SWR_KEY))
        void mutate(matchesSwrKey(QUERY_LOYALTY_MEMBER_SWR_KEY))
    }
    return {
        isPending,
        clear: () => {
            setAdjustNote(null)
            setRedeemNote(null)
        },
        busyReward,
        adjustNote,
        redeemNote,
        /** Saves name, birthday and note. */
        save: (fields: MemberFields) =>
            startTransition(async () => {
                const answer = await withToast(() => updateMember.trigger({ customerId, ...fields }), {
                    successMessage: t("saved"),
                })
                if (answer !== undefined) refresh()
            }),
        /** Records a signed point adjustment; calls `onDone` when the back end took it (posted or waiting). */
        adjust: (points: number, reason: string, onDone: () => void) =>
            startTransition(async () => {
                setAdjustNote(null)
                const answer = await withToast(
                    () => adjustPoints.trigger({ customerId, points, reason, token: adjustToken.current }),
                    { showSuccessToast: false },
                )
                if (answer === undefined) return
                adjustToken.current = newIdempotencyToken()
                setAdjustNote(answer.posted ? t("adjustDone") : t("adjustWaiting"))
                onDone()
                refresh()
            }),
        /** Redeems a reward for the member and tells whether it went through or waits for approval. */
        redeem: (rewardId: string) =>
            startTransition(async () => {
                setRedeemNote(null)
                setBusyReward(rewardId)
                const answer = await withToast(
                    () => redeemReward.trigger({ customerId, rewardId, token: redeemToken.current }),
                    { showSuccessToast: false },
                )
                setBusyReward(null)
                if (answer === undefined) return
                redeemToken.current = newIdempotencyToken()
                setRedeemNote({
                    id: rewardId,
                    text: answer.posted ? t("redeemDone", { code: answer.code }) : t("redeemWaiting"),
                })
                refresh()
            }),
    }
}
