"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** Validates an edited public reply before its approval is queued. */
export const useLeadGenCommentForm = () => {
    const t = useTranslations("workbenchLeadGen")
    const schema = useMemo(
        () => z.object({ draft: z.string().trim().min(1, t("draftRequired")).max(4000, t("draftTooLong")) }),
        [t],
    )
    return useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { draft: "" },
        mode: "onSubmit",
    })
}
