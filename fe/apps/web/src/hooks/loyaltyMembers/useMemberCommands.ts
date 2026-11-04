import { loyaltyReadOf, type LoyaltyPanelActivation, type useLoyaltyCommand } from "@/hooks/loyalty"
import {
    QUERY_LOYALTY_BOARD_SWR_KEY,
    QUERY_LOYALTY_MEMBER_SWR_KEY,
    useMutateAdjustLoyaltyPointsSwr,
    useMutateRedeemLoyaltyRewardSwr,
    useMutateUpdateLoyaltyMemberSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { mutate } from "@/modules/viewer-cache"
import { useTranslations } from "next-intl"

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

/** One idempotency token for a command: reused when a command fails, renewed once the back end took it. */
export interface CommandToken {
    readonly next: () => string
    readonly renew: () => void
}

interface MemberCommandsContext {
    readonly customerId: string
    readonly activation: LoyaltyPanelActivation
    readonly command: ReturnType<typeof useLoyaltyCommand>
    readonly adjustToken: CommandToken
    readonly redeemToken: CommandToken
    readonly setBusyReward: (value: string | null) => void
    readonly setAdjustNote: (value: string | null) => void
    readonly setRedeemNote: (value: ActionNote | null) => void
}

/** What `useMemberCommands` returns. */
export interface MemberCommandsResult {
    /** Saves name, birthday and note. */
    save: (fields: MemberFields) => void
    /** Records a signed point adjustment; calls `onDone` when the back end took it (posted or waiting). */
    adjust: (points: number, reason: string, onDone: () => void) => void
    /** Redeems a reward for the member and tells whether it went through or waits for approval. */
    redeem: (rewardId: string) => void
}

/** The three member commands retain their transport, feedback and exact-cache settlement as one owner. */
export const useMemberCommands = (input: MemberCommandsContext): MemberCommandsResult => {
    const { customerId, activation, command, adjustToken, redeemToken, setBusyReward, setAdjustNote, setRedeemNote } =
        input
    const t = useTranslations("loyalty")
    const withToast = useGraphQLWithToast()
    const updateMember = useMutateUpdateLoyaltyMemberSwr()
    const adjustPoints = useMutateAdjustLoyaltyPointsSwr()
    const redeemReward = useMutateRedeemLoyaltyRewardSwr()
    const refresh = async () => {
        await Promise.all([
            mutate(loyaltyReadOf(activation.workspaceId, [QUERY_LOYALTY_BOARD_SWR_KEY])),
            mutate(loyaltyReadOf(activation.workspaceId, [QUERY_LOYALTY_MEMBER_SWR_KEY])),
        ])
    }
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
                    () => adjustPoints.trigger({ customerId, points, reason, token: adjustToken.next() }),
                    { showSuccessToast: false },
                )
                if (answer === undefined) return
                if (isCurrent()) {
                    adjustToken.renew()
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
                        () => redeemReward.trigger({ customerId, rewardId, token: redeemToken.next() }),
                        { showSuccessToast: false },
                    )
                    if (answer === undefined) return
                    if (isCurrent()) {
                        redeemToken.renew()
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
