"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { parseAmount } from "@/hooks/sales"
import { EMPTY_TYPED, fieldKey, type TypedDecisionValues } from "@/hooks/salesdecisions"

import type { SalesDecision } from "@/modules/types"

/** The typed edits of Sales cards, validated before an approval is queued. */
export const useSalesDecisionForm = () => {
    const t = useTranslations("workbenchSales")
    const schema = useMemo(
        () =>
            z.object({
                editing: z.record(z.string(), z.boolean()),
                drafts: z.record(z.string(), z.string().max(4000, t("formTextTooLong", { n: 4000 }))),
                amounts: z.record(z.string(), z.string()),
                values: z.record(z.string(), z.string().max(500, t("formTextTooLong", { n: 500 }))),
            }),
        [t],
    )
    const form = useForm<TypedDecisionValues>({ resolver: zodResolver(schema), defaultValues: EMPTY_TYPED })
    useWatch({ control: form.control })
    const typed = form.getValues()
    const validateEditedAmount = (item: SalesDecision, amount: z.ZodString): string | undefined => {
        if (!typed.editing[item.id] || !item.hasAmount || item.missing.includes("amount_vnd")) return undefined
        const raw = typed.amounts[item.id] ?? (item.amountVnd === null ? "" : String(item.amountVnd))
        if (!raw) return undefined
        const parsed = amount.safeParse(raw)
        return parsed.success ? undefined : parsed.error.issues[0]?.message
    }
    const validateDecision = (item: SalesDecision): string | undefined => {
        const required = z
            .string()
            .trim()
            .min(1, t("salesDecisionInvalid"))
            .max(500, t("formTextTooLong", { n: 500 }))
        const amount = z
            .string()
            .trim()
            .regex(/^[\d\s.,]+$/, t("salesAmountInvalid"))
            .refine((raw) => {
                const value = parseAmount(raw)
                return value !== null && Number.isSafeInteger(value) && value <= 1000000000000
            }, t("salesAmountInvalid"))
        if (typed.editing[item.id]) {
            const draft = z
                .string()
                .max(4000, t("formTextTooLong", { n: 4000 }))
                .safeParse(typed.drafts[item.id] ?? item.draft)
            if (!draft.success) return draft.error.issues[0]?.message
        }
        for (const name of item.missing) {
            const raw = typed.values[fieldKey(item.id, name)] ?? ""
            const parsed = (name === "amount_vnd" ? amount : required).safeParse(raw)
            if (!parsed.success) return parsed.error.issues[0]?.message
        }
        return validateEditedAmount(item, amount)
    }
    return {
        typed,
        validateDecision,
        validateForm: (item: SalesDecision) =>
            form.trigger([
                `drafts.${item.id}`,
                ...item.missing.map((name) => `values.${fieldKey(item.id, name)}` as const),
            ]),
        field: (id: string, name: string, value: string) => form.setValue(`values.${fieldKey(id, name)}`, value),
        draft: (id: string, value: string) => form.setValue(`drafts.${id}`, value),
        amount: (id: string, value: string) => form.setValue(`amounts.${id}`, value),
        toggleEdit: (id: string) => form.setValue(`editing.${id}`, !typed.editing[id]),
        finish: (id: string) => form.setValue(`editing.${id}`, false),
    }
}
