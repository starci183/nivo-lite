"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { INPUT_BOUNDS, inputBoundsIssues } from "@/modules/api"

/** The editable snapshot the owner has reviewed. */
export interface PublicDocumentEditValues {
    title: string
    body: string
}

/** Validates edits against the current backend contract without changing the body the owner reviewed. */
export const usePublicDocumentEditForm = (values: PublicDocumentEditValues) => {
    const t = useTranslations("publicBrain")
    const schema = useMemo(
        () =>
            z
                .object({
                    title: z.string().trim().min(1, t("pickNeedTitle")),
                    body: z.string(),
                })
                .superRefine((value, context) => {
                    for (const issue of inputBoundsIssues(INPUT_BOUNDS.UpdatePublicDocumentInput, value)) {
                        context.addIssue({
                            code: "custom",
                            path: [...issue.path],
                            message: t("fieldTooLong", { max: issue.bound }),
                        })
                    }
                }),
        [t],
    )
    return useForm<PublicDocumentEditValues>({
        resolver: zodResolver(schema),
        values,
        resetOptions: { keepDirtyValues: true },
        mode: "onSubmit",
    })
}
