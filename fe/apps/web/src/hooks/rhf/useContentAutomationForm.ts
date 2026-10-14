"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { ContentSettings } from "@/modules/content"

/** Validates switches before changing a workspace automation. */
export const useContentAutomationForm = (initial: ContentSettings) => {
    const t = useTranslations("content")
    const schema = useMemo(
        () =>
            z.object({
                today_reminder: z.boolean({ error: t("err_input") }),
                offer_draft: z.boolean({ error: t("err_input") }),
                weekly_summary: z.boolean({ error: t("err_input") }),
            }),
        [t],
    )
    const form = useForm<ContentSettings["automations"]>({
        resolver: zodResolver(schema),
        defaultValues: initial.automations,
    })
    const { reset } = form
    useEffect(() => reset(initial.automations), [initial.automations, reset])
    return form
}
