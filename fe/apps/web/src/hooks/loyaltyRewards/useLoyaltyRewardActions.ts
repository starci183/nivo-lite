import { useLoyaltyCommand, loyaltyReadOf, type LoyaltyPanelActivation } from "@/hooks/loyalty"
import { mutate } from "@/modules/viewer-cache"

import { useTranslations } from "next-intl"
import {
    QUERY_LOYALTY_BOARD_SWR_KEY,
    useMutateAddLoyaltyPresetRewardsSwr,
    useMutateRemoveLoyaltyRewardSwr,
    useMutateSaveLoyaltyRewardSwr,
} from "@/hooks/swr"
import type { rewardInputOf } from "./loyaltyRewards.shared"
import { toast, useGraphQLWithToast } from "@/modules/toast"

/** The commands on the reward catalogue; every answer becomes a toast and revalidates the loyalty board. */
export const useLoyaltyRewardActions = (activation: LoyaltyPanelActivation) => {
    const t = useTranslations("loyalty")
    const command = useLoyaltyCommand(activation)
    const tToast = useTranslations("toast")
    const withToast = useGraphQLWithToast()
    const saveReward = useMutateSaveLoyaltyRewardSwr()
    const removeReward = useMutateRemoveLoyaltyRewardSwr()
    const addPreset = useMutateAddLoyaltyPresetRewardsSwr()
    return {
        isPending: command.isPending,
        save: (input: ReturnType<typeof rewardInputOf>, finish: () => void) => {
            if (!activation.isActive) return
            command.dispatch(async (isCurrent) => {
                const answer = await withToast(() => saveReward.trigger(input), { successMessage: t("saved") })
                if (answer === undefined) return
                if (isCurrent()) finish()
                await mutate(loyaltyReadOf(activation.workspaceId, [QUERY_LOYALTY_BOARD_SWR_KEY]))
            })
        },
        /** Native confirmation closes only after a real deletion and its workspace refresh settle. */
        remove: async (rewardId: string, finish: () => void): Promise<void> => {
            const removed = await command.run(async (isCurrent) => {
                const answer = await withToast(() => removeReward.trigger({ rewardId }), { showSuccessToast: false })
                if (answer === undefined) return false
                if (!answer.deleted) {
                    if (isCurrent()) toast.danger(tToast("errorTitle"), { description: tToast("defaultError") })
                    return false
                }
                try {
                    await mutate(loyaltyReadOf(activation.workspaceId, [QUERY_LOYALTY_BOARD_SWR_KEY]))
                } catch (error) {
                    if (isCurrent()) toast.danger(tToast("errorTitle"), { description: tToast("defaultError") })
                    throw error
                }
                if (isCurrent()) {
                    finish()
                    toast.success(tToast("successTitle"), { description: t("saved") })
                }
                return true
            })
            if (removed !== true) throw new Error("Loyalty reward removal did not settle")
        },
        preset: () => {
            if (!activation.isActive) return
            command.dispatch(async (isCurrent) => {
                const answer = await withToast(() => addPreset.trigger(), { showSuccessToast: false })
                if (answer === undefined) return
                if (isCurrent())
                    toast.success(tToast("successTitle"), { description: t("presetDone", { n: answer.added }) })
                await mutate(loyaltyReadOf(activation.workspaceId, [QUERY_LOYALTY_BOARD_SWR_KEY]))
            })
        },
    }
}
