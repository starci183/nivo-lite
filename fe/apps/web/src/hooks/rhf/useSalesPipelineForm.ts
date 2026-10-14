"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** Validates the selected stage and the evidence needed to close a deal. */
export const useSalesPipelineForm = () => {
    const t = useTranslations("workbenchSales")
    const schema = useMemo(
        () =>
            z
                .object({
                    target: z.enum(["", "new", "qualified", "proposal", "won", "lost"]),
                    reason: z
                        .string()
                        .trim()
                        .max(2000, t("formTextTooLong", { n: 2000 })),
                })
                .superRefine((values, context) => {
                    if (values.target === "")
                        context.addIssue({ code: "custom", path: ["target"], message: t("moveConfirm") })
                    if ((values.target === "won" || values.target === "lost") && values.reason.length < 5) {
                        context.addIssue({ code: "custom", path: ["reason"], message: t("reasonHint", { n: 5 }) })
                    }
                }),
        [t],
    )
    return useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { target: "", reason: "" } })
}
