"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { parseDigits } from "@/hooks/loyalty"
import type { RewardFormValues } from "@/modules/types"

/** The reward form: a zod schema whose messages come from the `loyalty` catalog; `initial` is the reward it starts from. */
export const useLoyaltyRewardForm = (initial: RewardFormValues) => {
    const t = useTranslations("loyalty")
    const schema = useMemo(
        () =>
            z.object({
                name: z.string().trim().min(1, t("rewardNameRequired")),
                kind: z.string(),
                cost: z.string().refine((value) => (parseDigits(value) ?? 0) >= 1, t("rewardCostRequired")),
                value: z.string(),
                percent: z.string(),
                stock: z.string(),
                limit: z.string(),
                minTier: z.string(),
                note: z.string(),
                active: z.boolean(),
            }),
        [t],
    )
    return useForm<RewardFormValues>({
        resolver: zodResolver(schema),
        values: initial,
        mode: "onSubmit",
    })
}
