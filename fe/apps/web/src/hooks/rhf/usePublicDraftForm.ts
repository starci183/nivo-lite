"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { INPUT_BOUNDS, inputBoundsIssues } from "@/modules/api"
import type { UseFormReturn } from "react-hook-form"

/** The internal sources and instructions used to ask for a public draft. */
interface PublicDraftValues {
    title: string
    sourceIds: string[]
    instructions: string
}

type UsePublicDraftFormResult = {
    form: UseFormReturn<PublicDraftValues>
    maxSources: 5
}

/** Validates required fields and the backend's collection and text bounds. */
export const usePublicDraftForm = (): UsePublicDraftFormResult => {
    const t = useTranslations("publicBrain")
    const bounds = INPUT_BOUNDS.DraftPublicDocumentInput
    const schema = useMemo(
        () =>
            z
                .object({
                    title: z.string().trim().min(1, t("pickNeedTitle")),
                    sourceIds: z.array(z.string()).min(1, t("pickNeedSources", { max: bounds.sourceIds.maxItems })),
                    instructions: z.string().trim(),
                })
                .superRefine((value, context) => {
                    for (const issue of inputBoundsIssues(bounds, value)) {
                        const message =
                            issue.path[0] === "sourceIds"
                                ? t("pickNeedSources", { max: bounds.sourceIds.maxItems })
                                : t("fieldTooLong", { max: issue.bound })
                        context.addIssue({ code: "custom", path: [...issue.path], message })
                    }
                }),
        [t, bounds],
    )
    const form = useForm<PublicDraftValues>({
        resolver: zodResolver(schema),
        defaultValues: { title: "", sourceIds: [], instructions: "" },
        mode: "onSubmit",
    })
    return { form, maxSources: bounds.sourceIds.maxItems }
}
