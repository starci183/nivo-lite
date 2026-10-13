"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { LOYALTY_ADJUST_REASON_MAX, parseSigned } from "@/hooks/loyalty"

/** The values of the point adjustment form; the points are typed as a signed number. */
export interface LoyaltyAdjustValues {
    points: string
    reason: string
}

/** The point adjustment form: a signed whole number other than zero and a required reason, with messages from the `loyalty` catalog. */
export const useLoyaltyAdjustForm = () => {
    const t = useTranslations("loyalty")
    const schema = useMemo(
        () =>
            z.object({
                points: z.string().refine((value) => {
                    const points = parseSigned(value)
                    return points !== null && points !== 0
                }, t("adjustPointsInvalid")),
                reason: z.string().trim().min(1, t("adjustReasonRequired")).max(LOYALTY_ADJUST_REASON_MAX),
            }),
        [t],
    )
    return useForm<LoyaltyAdjustValues>({
        resolver: zodResolver(schema),
        defaultValues: { points: "", reason: "" },
        mode: "onChange",
    })
}
