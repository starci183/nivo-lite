"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { INPUT_BOUNDS, inputBoundsIssues } from "@/modules/api"
import type { UseFormReturn } from "react-hook-form"

/** The separate document written for customers. */
interface PublicWriteValues {
    title: string
    body: string
}

/** Requires a title and body and reads all size limits from the emitted write contract. */
export const usePublicWriteForm = (title: string): UseFormReturn<PublicWriteValues> => {
    const t = useTranslations("publicBrain")
    const schema = useMemo(
        () =>
            z
                .object({
                    title: z.string().trim().min(1, t("writeNeedBoth")),
                    body: z.string().trim().min(1, t("writeNeedBoth")),
                })
                .superRefine((value, context) => {
                    for (const issue of inputBoundsIssues(INPUT_BOUNDS.WritePublicDocumentInput, value)) {
                        context.addIssue({
                            code: "custom",
                            path: [...issue.path],
                            message: t("fieldTooLong", { max: issue.bound }),
                        })
                    }
                }),
        [t],
    )
    return useForm<PublicWriteValues>({
        resolver: zodResolver(schema),
        defaultValues: { title, body: "" },
        mode: "onSubmit",
    })
}
