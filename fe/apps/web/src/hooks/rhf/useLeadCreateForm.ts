"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** Validated values of a manually captured lead. */
export interface LeadCreateValues {
    contact_name: string
    company: string
    channel: string
    need: string
}

/** The lead capture schema uses the catalog's field-level validation messages. */
export const useLeadCreateForm = () => {
    const t = useTranslations("leads")
    const schema = useMemo(
        () =>
            z.object({
                contact_name: z.string().trim().min(2, t("errContact")).max(200, t("errContact")),
                company: z.string().trim().min(2, t("errCompany")).max(200, t("errCompany")),
                channel: z.string().trim().min(1, t("errChannel")).max(100, t("errChannel")),
                need: z.string().trim().min(5, t("errNeed")).max(2000, t("errNeed")),
            }),
        [t],
    )
    return useForm<LeadCreateValues>({
        resolver: zodResolver(schema),
        defaultValues: { contact_name: "", company: "", channel: "", need: "" },
    })
}
