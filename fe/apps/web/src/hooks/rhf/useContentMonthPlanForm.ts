"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { UseFormReturn } from "react-hook-form"

type UseContentMonthPlanFormResult = UseFormReturn<{
    month: string
}>

/** Validates the month selection with localized messages before queuing a plan. */
export const useContentMonthPlanForm = (month: string): UseContentMonthPlanFormResult => {
    const t = useTranslations("content")
    const schema = useMemo(
        () => z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/u, t("err_month_invalid")) }),
        [t],
    )
    return useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { month } })
}
