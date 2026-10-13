import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { digitsToNumber, vietnamToday } from "@/modules/utils"
import { dayjs } from "@/modules/dayjs"

/** The owner's typed manual credit fields. */
export interface AccountingEvidenceValues {
    amount: string
    date: string
    content: string
    payer: string
    note: string
}

/** Validates the same amount, date and text bounds as the backend before recording evidence. */
export const useAccountingEvidenceForm = () => {
    const t = useTranslations("workbenchAccounting")
    const today = vietnamToday()
    const schema = useMemo(
        () =>
            z.object({
                amount: z.string().refine((raw) => {
                    const amount = digitsToNumber(raw)
                    return amount !== null && amount > 0 && amount <= 1_000_000_000_000
                }, t("errAmount")),
                date: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/u, t("errDate"))
                    .refine(
                        (date) => dayjs(date).isValid() && dayjs(date).format("YYYY-MM-DD") === date && date <= today,
                        t("errDate"),
                    ),
                content: z.string().trim().min(3, t("errContent")).max(500, t("errContent")),
                payer: z.string().trim().max(120, t("errPayer")),
                note: z.string().trim().max(1000, t("errNote")),
            }),
        [t, today],
    )
    return useForm<AccountingEvidenceValues>({
        resolver: zodResolver(schema),
        defaultValues: { amount: "", date: today, content: "", payer: "", note: "" },
        mode: "onSubmit",
    })
}
