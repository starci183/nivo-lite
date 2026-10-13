"use client"

import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { useSWRConfig } from "swr"
import {
    isQueryLoyaltyBoardSwrKey,
    useMutateAddLoyaltyPresetRewardsSwr,
    useMutateRemoveLoyaltyRewardSwr,
    useMutateSaveLoyaltyRewardSwr,
} from "@/hooks/swr/api/graphql"
import type { rewardInputOf } from "./loyaltyRewards.shared"
import { toast, useGraphQLWithToast } from "@/modules/toast"

/** The commands on the reward catalogue; every answer becomes a toast and revalidates the loyalty board. */
export const useLoyaltyRewardActions = () => {
    const t = useTranslations("loyalty")
    const tToast = useTranslations("toast")
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const saveReward = useMutateSaveLoyaltyRewardSwr()
    const removeReward = useMutateRemoveLoyaltyRewardSwr()
    const addPreset = useMutateAddLoyaltyPresetRewardsSwr()
    const [isPending, startTransition] = useTransition()
    return {
        isPending,
        save: (input: ReturnType<typeof rewardInputOf>, finish: () => void) =>
            startTransition(async () => {
                const answer = await withToast(() => saveReward.trigger(input), { successMessage: t("saved") })
                if (answer === undefined) return
                finish()
                void mutate(isQueryLoyaltyBoardSwrKey)
            }),
        remove: (rewardId: string, finish: () => void) =>
            startTransition(async () => {
                const answer = await withToast(() => removeReward.trigger({ rewardId }), {
                    successMessage: t("saved"),
                })
                finish()
                if (answer === undefined) return
                void mutate(isQueryLoyaltyBoardSwrKey)
            }),
        preset: () =>
            startTransition(async () => {
                const answer = await withToast(() => addPreset.trigger(), { showSuccessToast: false })
                if (answer === undefined) return
                toast.success(tToast("successTitle"), { description: t("presetDone", { n: answer.added }) })
                void mutate(isQueryLoyaltyBoardSwrKey)
            }),
    }
}
