"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** The values of the row's change password form. */
export interface SmtpRowPasswordValues {
    password: string
}

/** The mini form of an SMTP row that changes the password: the new password must not be empty. */
export const useSmtpRowPasswordForm = () => {
    const t = useTranslations("email")
    const schema = useMemo(() => z.object({ password: z.string().trim().min(1, t("err_password")) }), [t])
    return useForm<SmtpRowPasswordValues>({
        resolver: zodResolver(schema),
        defaultValues: { password: "" },
        mode: "onSubmit",
    })
}
