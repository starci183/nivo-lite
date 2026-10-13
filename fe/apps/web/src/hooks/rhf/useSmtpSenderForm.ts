"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** The values of the sender and password step. */
export interface SmtpSenderValues {
    fromName: string
    fromEmail: string
    replyTo: string
    user: string
    password: string
}

/** What the chosen provider and way of sending ask of the sender form. */
interface SmtpSenderRules {
    /** The form asks for a password (Google's relay needs none). */
    readonly needsPassword: boolean
    /** A username the provider fixes, so the owner types none. */
    readonly fixedUser: string | undefined
    /** The username is the sender mailbox. */
    readonly userIsEmail: boolean
}

const isEmail = (value: string): boolean => z.email().safeParse(value).success

/** The sender and password step of the outgoing-email wizard: a zod schema (words from the `email` catalog) that follows the chosen provider. */
export const useSmtpSenderForm = (rules: SmtpSenderRules) => {
    const t = useTranslations("email")
    const { needsPassword, fixedUser, userIsEmail } = rules
    const schema = useMemo(
        () =>
            z
                .object({
                    fromName: z.string().trim().min(1, t("err_fields")),
                    fromEmail: z.string().trim().min(1, t("err_fields")).refine(isEmail, t("err_email")),
                    replyTo: z
                        .string()
                        .trim()
                        .refine((value) => value === "" || isEmail(value), t("err_email")),
                    user: z.string(),
                    password: z.string(),
                })
                .superRefine((values, context) => {
                    const user = fixedUser ?? (values.user.trim() || (userIsEmail ? values.fromEmail.trim() : ""))
                    if (user === "") context.addIssue({ code: "custom", path: ["user"], message: t("err_fields") })
                    if (needsPassword && values.password.trim() === "") {
                        context.addIssue({ code: "custom", path: ["password"], message: t("err_fields") })
                    }
                }),
        [t, needsPassword, fixedUser, userIsEmail],
    )
    return useForm<SmtpSenderValues>({
        resolver: zodResolver(schema),
        defaultValues: { fromName: "", fromEmail: "", replyTo: "", user: "", password: "" },
        mode: "onChange",
    })
}
