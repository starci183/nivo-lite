import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { WorkItemView } from "@/lib/flow-types"
import type { AccountingQuestionValues } from "@/modules/types"
import { digitsToNumber } from "@/modules/utils"
import type { AccountingTranslator } from "@/modules/utils"

interface AccountingQuestionsValues {
    items: Record<string, AccountingQuestionValues>
}

const schemaOf = (item: WorkItemView, t: AccountingTranslator, accounting: AccountingTranslator) =>
    z
        .object({
            fields: z.record(z.string(), z.string().trim().max(10_000, t("exceptionMissingHint"))),
            draft: z.string().trim().max(10_000, t("exceptionMissingHint")),
            amount: z.string(),
            candidateId: z.string(),
            basis: z
                .string()
                .trim()
                .max(2_000, t("basisHint", { n: 10 })),
        })
        .superRefine((values, context) => {
            for (const name of item.missing_fields) {
                const raw = values.fields[name] ?? ""
                if (raw.trim() === "")
                    context.addIssue({ code: "custom", path: ["fields", name], message: t("exceptionMissingHint") })
                else if (
                    name === "amount_vnd" &&
                    (!digitsToNumber(raw) || (digitsToNumber(raw) ?? 0) > 1_000_000_000_000)
                ) {
                    context.addIssue({ code: "custom", path: ["fields", name], message: accounting("errAmount") })
                }
            }
            if (
                item.proposal.candidates?.length &&
                !item.proposal.candidates.some((candidate) => candidate.id === values.candidateId)
            ) {
                context.addIssue({ code: "custom", path: ["candidateId"], message: t("exceptionMissingHint") })
            }
            if (item.action === "reconcile_payment" && values.basis.replace(/\s+/gu, " ").length < 10) {
                context.addIssue({ code: "custom", path: ["basis"], message: t("basisRequiredError", { n: 10 }) })
            }
            if (
                values.amount &&
                ((digitsToNumber(values.amount) ?? -1) < 0 || (digitsToNumber(values.amount) ?? 0) > 1_000_000_000_000)
            ) {
                context.addIssue({ code: "custom", path: ["amount"], message: accounting("errAmount") })
            }
        })

/** Holds every question's independent inputs in one form; callers validate only the addressed item path. */
export const useAccountingQuestionsForm = (items: ReadonlyArray<WorkItemView>) => {
    const t = useTranslations("office")
    const accounting = useTranslations("workbenchAccounting")
    const schema = useMemo(() => {
        const shapes: Record<string, ReturnType<typeof schemaOf>> = Object.fromEntries(
            items.map((item) => [item.id, schemaOf(item, t, accounting)]),
        )
        return z.object({ items: z.object(shapes) })
    }, [accounting, items, t])
    return useForm<AccountingQuestionsValues>({
        resolver: zodResolver(schema),
        defaultValues: { items: {} },
        mode: "onSubmit",
    })
}
