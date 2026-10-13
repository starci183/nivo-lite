"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { EMAIL_PATTERN, NAME_MIN_LENGTH, PASSWORD_MIN_LENGTH } from "@/hooks/auth"

/** The values of the sign-up form. */
export interface SignupValues {
    name: string
    email: string
    password: string
    confirm: string
}

/** The sign-up form: a zod schema whose messages come from the `auth` catalog; `initialEmail` pre-fills the address. */
export const useSignupForm = (initialEmail: string | undefined) => {
    const t = useTranslations("auth")
    const schema = useMemo(
        () =>
            z
                .object({
                    name: z.string().trim().min(NAME_MIN_LENGTH, t("errName")),
                    email: z.string().trim().regex(EMAIL_PATTERN, t("errEmail")),
                    password: z.string().min(PASSWORD_MIN_LENGTH, t("errPasswordShort")),
                    confirm: z.string(),
                })
                .refine((values) => values.confirm === values.password, {
                    path: ["confirm"],
                    message: t("errPasswordMismatch"),
                }),
        [t],
    )
    return useForm<SignupValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: "", email: initialEmail ?? "", password: "", confirm: "" },
        mode: "onSubmit",
    })
}
