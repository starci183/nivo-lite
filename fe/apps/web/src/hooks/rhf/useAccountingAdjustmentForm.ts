"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

/** The accounting correction form, validated before calling the mutation. */
export const useAccountingAdjustmentForm = () => {
    const t = useTranslations("workbenchAccounting")
    const schema = z.object({
        note: z.string().trim().min(5, t("errAdjustNote")).max(1000, t("errAdjustNote")),
        amount: z.string().refine((value) => {
            if (value === "") return true
            if (!/^[\d\s.,]+$/u.test(value) || !/\d/u.test(value)) return false
            const parsed = Number(value.replace(/\D/gu, ""))
            return Number.isSafeInteger(parsed) && parsed >= 0
        }, t("errAmount")),
    })
    const form = useForm<z.infer<typeof schema>>({
        defaultValues: { note: "", amount: "" },
        resolver: zodResolver(schema),
    })
    const values = useWatch({ control: form.control })
    return {
        form,
        values,
        error: form.formState.errors.note?.message ?? form.formState.errors.amount?.message ?? null,
    }
}
