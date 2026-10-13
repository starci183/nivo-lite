"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { EMAIL_PATTERN } from "@/hooks/auth"

/** The values of the new-email form. */
export interface EmailValues {
    email: string
}

/** The longest address the form accepts. */
const EMAIL_MAX = 254

/** The new sign-in address form: a zod schema whose messages come from the `account` catalog. */
export const useEmailForm = () => {
    const t = useTranslations("account")
    const schema = useMemo(
        () => z.object({ email: z.string().trim().max(EMAIL_MAX, t("errEmail")).regex(EMAIL_PATTERN, t("errEmail")) }),
        [t],
    )
    return useForm<EmailValues>({ resolver: zodResolver(schema), defaultValues: { email: "" }, mode: "onSubmit" })
}
