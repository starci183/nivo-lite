"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { parseAmount } from "@/hooks/sales"
import { CONTRACT_STATUS_KEYS, contractFormOf } from "@/hooks/salescontracts"
import type { ContractForm } from "@/hooks/salescontracts"

/** Accepts an ISO calendar day and rejects dates outside the calendar. */
const isContractDay = (value: string): boolean => z.iso.date().safeParse(value).success

/** Validates recurring contract values before the GraphQL save runs. */
export const useSalesContractForm = (today: string) => {
    const t = useTranslations("workbenchSales")
    const schema = useMemo(
        () =>
            z
                .object({
                    leadId: z.string(),
                    customerName: z
                        .string()
                        .trim()
                        .min(1, t("errContractCustomer"))
                        .max(200, t("formTextTooLong", { n: 200 })),
                    plan: z
                        .string()
                        .trim()
                        .max(200, t("formTextTooLong", { n: 200 })),
                    startsOn: z.string().refine(isContractDay, t("errDate")),
                    endsOn: z.string().refine(isContractDay, t("errDate")),
                    amount: z.string().refine((value) => {
                        if (value.trim() === "") return true
                        const amount = parseAmount(value)
                        return /^[\d.,\s]+$/u.test(value) && amount !== null && Number.isSafeInteger(amount)
                    }, t("errContractAmount")),
                    status: z.enum(["active", "ended", "cancelled"], {
                        error: t("errContractStatus", { list: CONTRACT_STATUS_KEYS.join(", ") }),
                    }),
                    note: z
                        .string()
                        .trim()
                        .max(600, t("formTextTooLong", { n: 600 })),
                })
                .refine(
                    (values) =>
                        !isContractDay(values.startsOn) ||
                        !isContractDay(values.endsOn) ||
                        values.endsOn >= values.startsOn,
                    {
                        path: ["endsOn"],
                        message: t("errContractDates"),
                    },
                ),
        [t],
    )

    return useForm<ContractForm>({
        resolver: zodResolver(schema),
        defaultValues: contractFormOf(null, today),
        mode: "onSubmit",
    })
}
