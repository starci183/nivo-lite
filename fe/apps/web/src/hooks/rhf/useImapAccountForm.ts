"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** The values of the mailbox account form; the port travels as typed text. */
export interface ImapAccountValues {
    name: string
    email: string
    host: string
    port: string
    security: "tls" | "starttls"
    user: string
    password: string
}

const PORT_MAX = 65_535

/** A new mailbox starts on Gmail. */
const EMPTY_ACCOUNT: ImapAccountValues = {
    name: "",
    email: "",
    host: "imap.gmail.com",
    port: "993",
    security: "tls",
    user: "",
    password: "",
}

/**
 * The mailbox account form: connection name, address, server, port, security, login and password. A blank password is accepted
 * only when the mailbox is already saved (the saved one is kept). Messages come from the `connectorImap` catalog.
 */
export const useImapAccountForm = (hasSavedPassword: boolean, initial: ImapAccountValues = EMPTY_ACCOUNT) => {
    const t = useTranslations("connectorImap")
    const schema = useMemo(
        () =>
            z.object({
                name: z.string().trim().min(1, t("errName")),
                email: z.string().trim().min(1, t("errEmail")),
                host: z
                    .string()
                    .trim()
                    .min(1, t("errHost"))
                    .refine((host) => !/[\s/]/u.test(host), t("errHost")),
                port: z
                    .string()
                    .trim()
                    .refine(
                        (port) => /^\d+$/u.test(port) && Number(port) >= 1 && Number(port) <= PORT_MAX,
                        t("errPort"),
                    ),
                security: z.enum(["tls", "starttls"]),
                user: z.string(),
                password: hasSavedPassword ? z.string() : z.string().min(1, t("errPassword")),
            }),
        [t, hasSavedPassword],
    )
    return useForm<ImapAccountValues>({
        resolver: zodResolver(schema),
        defaultValues: initial,
        mode: "onChange",
    })
}
