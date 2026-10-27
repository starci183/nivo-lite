"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { parseAmount } from "@/hooks/sales"
import type { SalesContractStatus } from "@/modules/types"

/** What a person has typed into the contract form. */
export interface ContractForm {
    readonly leadId: string
    readonly customerName: string
    readonly plan: string
    readonly startsOn: string
    readonly endsOn: string
    readonly amount: string
    readonly status: SalesContractStatus
    readonly note: string
}

/** The statuses the form accepts, in the order its error lists them. */
const STATUSES = ["active", "ended", "cancelled"] as const satisfies ReadonlyArray<SalesContractStatus>

/** Accepts an ISO calendar day and rejects dates outside the calendar. */
const isContractDay = (value: string): boolean => z.iso.date().safeParse(value).success

/** Validates recurring contract values before the GraphQL save runs; `defaultValues` is the form of a new contract. */
export const useSalesContractForm = (defaultValues: ContractForm) => {
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
                    status: z.enum(STATUSES, {
                        error: t("errContractStatus", { list: STATUSES.join(", ") }),
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
        defaultValues,
        mode: "onSubmit",
    })
}
