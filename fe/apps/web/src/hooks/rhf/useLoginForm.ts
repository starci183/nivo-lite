"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { EMAIL_PATTERN } from "@/hooks/auth"

/** The values of the sign-in form. */
export interface LoginValues {
    email: string
    password: string
}

/** The sign-in form: a zod schema whose messages come from the `auth` catalog, validated before the sign-in runs. */
export const useLoginForm = () => {
    const t = useTranslations("auth")
    const schema = useMemo(
        () =>
            z.object({
                email: z.string().trim().regex(EMAIL_PATTERN, t("errEmail")),
                password: z.string().min(1, t("errPasswordRequired")),
            }),
        [t],
    )
    return useForm<LoginValues>({
        resolver: zodResolver(schema),
        defaultValues: { email: "", password: "" },
        mode: "onSubmit",
    })
}
