"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** The longest offer name and offer text the form accepts. */
export interface LoyaltyCampaignLimits {
    readonly nameMax: number
    readonly briefMax: number
}

/** The values of the promotion form: the segment fields, the offer name and the offer text. */
export interface LoyaltyCampaignValues {
    tiers: Array<string>
    inactive: string
    spend: string
    birthday: boolean
    name: string
    brief: string
}

const EMPTY: LoyaltyCampaignValues = { tiers: [], inactive: "", spend: "", birthday: false, name: "", brief: "" }

/** The promotion form: a zod schema whose messages come from the `loyalty` catalog; the offer text is the only required field. */
export const useLoyaltyCampaignForm = (limits: LoyaltyCampaignLimits) => {
    const t = useTranslations("loyalty")
    const schema = useMemo(
        () =>
            z.object({
                tiers: z.array(z.string()),
                inactive: z.string(),
                spend: z.string(),
                birthday: z.boolean(),
                name: z.string().trim().max(limits.nameMax),
                brief: z.string().trim().min(1, t("briefRequired")).max(limits.briefMax),
            }),
        [t, limits.nameMax, limits.briefMax],
    )
    return useForm<LoyaltyCampaignValues>({
        resolver: zodResolver(schema),
        defaultValues: EMPTY,
        mode: "onSubmit",
    })
}
