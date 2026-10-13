"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { EMAIL_PATTERN } from "@/hooks/auth"

/** The values of the forgot-password form. */
export interface ForgotValues {
    email: string
}

/** The forgot-password form: a zod schema whose messages come from the `auth` catalog; `initialEmail` pre-fills the address. */
export const useForgotForm = (initialEmail: string | undefined) => {
    const t = useTranslations("auth")
    const schema = useMemo(() => z.object({ email: z.string().trim().regex(EMAIL_PATTERN, t("errEmail")) }), [t])
    return useForm<ForgotValues>({
        resolver: zodResolver(schema),
        defaultValues: { email: initialEmail ?? "" },
        mode: "onSubmit",
    })
}
