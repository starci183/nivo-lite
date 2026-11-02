import { useLoyaltyCommand, loyaltyReadOf, type LoyaltyPanelActivation } from "@/hooks/loyalty"
import { mutate } from "@/modules/viewer-cache"

import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import {
    QUERY_LOYALTY_BOARD_SWR_KEY,
    QUERY_LOYALTY_MEMBER_SWR_KEY,
    useMutateAdjustLoyaltyPointsSwr,
    useMutateRedeemLoyaltyRewardSwr,
    useMutateUpdateLoyaltyMemberSwr,
} from "@/hooks/swr"
import { newIdempotencyToken } from "@/modules/utils"
import { useGraphQLWithToast } from "@/modules/toast"
import { useFeatureReset } from "@/hooks/reuseables"

/** The outcome line shown under a reward after a redemption. */
interface ActionNote {
    readonly id: string
    readonly text: string
}

/** The member details the form saves; the birthday is the ISO date or null. */
interface MemberFields {
    readonly name: string
    readonly birthday: string | null
    readonly note: string
}

/** What the member page writes: details, point adjustments and redemptions, each toasted and followed by a revalidation. */
export const useMemberActions = (customerId: string, activation: LoyaltyPanelActivation) => {
    const t = useTranslations("loyalty")
    const withToast = useGraphQLWithToast()
    const updateMember = useMutateUpdateLoyaltyMemberSwr()
    const adjustPoints = useMutateAdjustLoyaltyPointsSwr()
    const redeemReward = useMutateRedeemLoyaltyRewardSwr()
    const adjustToken = useRef(newIdempotencyToken())
    const redeemToken = useRef(newIdempotencyToken())
    const [busyReward, setBusyReward] = useState<string | null>(null)
    const [adjustNote, setAdjustNote] = useState<string | null>(null)
    const [redeemNote, setRedeemNote] = useState<ActionNote | null>(null)
    const scope = JSON.stringify([activation.scope, customerId])
    const command = useLoyaltyCommand({ ...activation, scope, isActive: activation.isActive && customerId !== "" })
    useFeatureReset({
        ...activation,
        scope,
        onReset: () => {
            setBusyReward(null)
            setAdjustNote(null)
            setRedeemNote(null)
            adjustToken.current = newIdempotencyToken()
            redeemToken.current = newIdempotencyToken()
        },
    })
    const refresh = async () => {
        await Promise.all([
            mutate(loyaltyReadOf(activation.workspaceId, [QUERY_LOYALTY_BOARD_SWR_KEY])),
            mutate(loyaltyReadOf(activation.workspaceId, [QUERY_LOYALTY_MEMBER_SWR_KEY])),
        ])
    }
    return {
        isPending: command.isPending,
        clear: () => {
            setAdjustNote(null)
            setRedeemNote(null)
        },
        busyReward,
        adjustNote,
        redeemNote,
        ...memberCommandsOf({
            customerId,
            activation,
            t,
            withToast,
            updateMember,
            adjustPoints,
            redeemReward,
            command,
            adjustToken,
            redeemToken,
            setBusyReward,
            setAdjustNote,
            setRedeemNote,
            refresh,
        }),
    }
}

interface MemberCommandsContext {
    readonly customerId: string
    readonly activation: LoyaltyPanelActivation
    readonly t: ReturnType<typeof useTranslations<"loyalty">>
    readonly withToast: ReturnType<typeof useGraphQLWithToast>
    readonly updateMember: ReturnType<typeof useMutateUpdateLoyaltyMemberSwr>
    readonly adjustPoints: ReturnType<typeof useMutateAdjustLoyaltyPointsSwr>
    readonly redeemReward: ReturnType<typeof useMutateRedeemLoyaltyRewardSwr>
    readonly command: ReturnType<typeof useLoyaltyCommand>
    readonly adjustToken: { current: string }
    readonly redeemToken: { current: string }
    readonly setBusyReward: (value: string | null) => void
    readonly setAdjustNote: (value: string | null) => void
    readonly setRedeemNote: (value: ActionNote | null) => void
    readonly refresh: () => Promise<void>
}
/** The three member commands retain their transport, feedback and exact-cache settlement as one owner. */
const memberCommandsOf = (input: MemberCommandsContext) => {
    const {
        customerId,
        activation,
        t,
        withToast,
        updateMember,
        adjustPoints,
        redeemReward,
        command,
        adjustToken,
        redeemToken,
        setBusyReward,
        setAdjustNote,
        setRedeemNote,
        refresh,
    } = input
    return {
        /** Saves name, birthday and note. */
        save: (fields: MemberFields) => {
            if (!activation.isActive || customerId === "") return
            command.dispatch(async () => {
                const answer = await withToast(() => updateMember.trigger({ customerId, ...fields }), {
                    successMessage: t("saved"),
                })
                if (answer !== undefined) await refresh()
            })
        },
        /** Records a signed point adjustment; calls `onDone` when the back end took it (posted or waiting). */
        adjust: (points: number, reason: string, onDone: () => void) => {
            if (!activation.isActive || customerId === "") return
            command.dispatch(async (isCurrent) => {
                setAdjustNote(null)
                const answer = await withToast(
                    () => adjustPoints.trigger({ customerId, points, reason, token: adjustToken.current }),
                    { showSuccessToast: false },
                )
                if (answer === undefined) return
                if (isCurrent()) {
                    adjustToken.current = newIdempotencyToken()
                    setAdjustNote(answer.posted ? t("adjustDone") : t("adjustWaiting"))
                    onDone()
                }
                await refresh()
            })
        },
        /** Redeems a reward for the member and tells whether it went through or waits for approval. */
        redeem: (rewardId: string) => {
            if (!activation.isActive || customerId === "") return
            command.dispatch(async (isCurrent) => {
                setRedeemNote(null)
                setBusyReward(rewardId)
                try {
                    const answer = await withToast(
                        () => redeemReward.trigger({ customerId, rewardId, token: redeemToken.current }),
                        { showSuccessToast: false },
                    )
                    if (answer === undefined) return
                    if (isCurrent()) {
                        redeemToken.current = newIdempotencyToken()
                        setRedeemNote({
                            id: rewardId,
                            text: answer.posted ? t("redeemDone", { code: answer.code }) : t("redeemWaiting"),
                        })
                    }
                    await refresh()
                } finally {
                    if (isCurrent()) setBusyReward(null)
                }
            })
        },
    }
}
