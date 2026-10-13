"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { HHMM, toNumber } from "@/hooks/loyaltyProgram"
import type { ProgramValues } from "@/hooks/loyaltyProgram"

/** The whole-programme form: a zod schema whose messages come from the `loyalty` catalog; `initial` is the saved programme it starts from. */
export const useLoyaltyProgramForm = (initial: ProgramValues) => {
    const t = useTranslations("loyalty")
    const schema = useMemo(
        () =>
            z
                .object({
                    name: z.string().trim().min(1, t("errName")),
                    enabled: z.boolean(),
                    perThousand: z.string(),
                    perVisit: z.string(),
                    minOrder: z.string(),
                    trigger: z.string(),
                    categories: z.array(
                        z.object({ uid: z.string(), match: z.string(), rate: z.string(), label: z.string() }),
                    ),
                    tiers: z
                        .array(
                            z.object({
                                uid: z.string(),
                                key: z.string(),
                                name: z.string().trim().min(1, t("errTierName")),
                                minSpend: z.string(),
                                multiplier: z.string(),
                                winback: z.string(),
                                benefit: z.string(),
                            }),
                        )
                        .min(1, t("errTiers")),
                    expiryMonths: z.string(),
                    warnDays: z.string(),
                    birthdayOn: z.boolean(),
                    birthdayPoints: z.string(),
                    birthdayReward: z.string(),
                    birthdayNote: z.string(),
                    maxPerMonth: z.string(),
                    hourFrom: z.string().regex(HHMM, t("errHours")),
                    hourTo: z.string().regex(HHMM, t("errHours")),
                    batch: z.string(),
                })
                .superRefine((values, ctx) => {
                    values.tiers.forEach((tier, position) => {
                        if (position === 0) return
                        const floor = position === 1 ? 0 : toNumber(values.tiers[position - 1]?.minSpend ?? "")
                        if (toNumber(tier.minSpend) <= floor)
                            ctx.addIssue({
                                code: "custom",
                                message: t("errTierOrder"),
                                path: ["tiers", position, "minSpend"],
                            })
                    })
                }),
        [t],
    )
    return useForm<ProgramValues>({
        resolver: zodResolver(schema),
        values: initial,
        resetOptions: { keepDirtyValues: true },
        mode: "onSubmit",
    })
}
