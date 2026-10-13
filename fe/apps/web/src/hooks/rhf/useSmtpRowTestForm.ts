"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** The values of the row's test email form. */
export interface SmtpRowTestValues {
    to: string
}

/** The mini form of an SMTP row that sends a test email: the address must be an email address. */
export const useSmtpRowTestForm = (ownerEmail: string) => {
    const t = useTranslations("email")
    const schema = useMemo(
        () =>
            z.object({
                to: z
                    .string()
                    .trim()
                    .pipe(z.email(t("err_email"))),
            }),
        [t],
    )
    return useForm<SmtpRowTestValues>({
        resolver: zodResolver(schema),
        defaultValues: { to: ownerEmail },
        mode: "onSubmit",
    })
}
