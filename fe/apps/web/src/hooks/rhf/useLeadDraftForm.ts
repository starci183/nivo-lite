"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { UseFormReturn } from "react-hook-form"

type UseLeadDraftFormResult = UseFormReturn<{
    draft: string
}>

/** Validates an edited follow-up message before it is approved. */
export const useLeadDraftForm = (draft: string): UseLeadDraftFormResult => {
    const t = useTranslations("lead")
    const schema = useMemo(
        () => z.object({ draft: z.string().trim().min(1, t("errDraft")).max(4000, t("errDraft")) }),
        [t],
    )
    return useForm<{ draft: string }>({ resolver: zodResolver(schema), defaultValues: { draft } })
}
