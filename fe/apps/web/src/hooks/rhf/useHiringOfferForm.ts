"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { OfferValues } from "@/hooks/hiringCandidate"

/** The offer request form: the terms of the letter, the pay being the one required line. */
export const useHiringOfferForm = (defaults: OfferValues) => {
    const t = useTranslations("hiring")
    const schema = useMemo(
        () =>
            z.object({
                title: z.string(),
                pay: z.string().trim().min(1, t("offerPayHint")),
                startDate: z.string(),
                probation: z.string(),
                note: z.string(),
            }),
        [t],
    )
    return useForm<OfferValues>({ resolver: zodResolver(schema), values: defaults, mode: "onChange" })
}
