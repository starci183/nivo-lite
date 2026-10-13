"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** The values of the name and consent step. */
export interface TelegramConsentValues {
    name: string
    consent: boolean
}

/** The values of the phone step. */
export interface TelegramPhoneValues {
    phone: string
}

/** The values of the login code step. */
export interface TelegramCodeValues {
    code: string
}

/** The values of the two-step password step. */
export interface TelegramPasswordValues {
    password: string
}

/** Where the name and consent form starts. */
interface TelegramConsentStart {
    readonly name: string
    readonly consent: boolean
}

/** A phone number with a country code (or a local 0 / 84 start): 8 to 15 digits. */
const isPhone = (raw: string): boolean => {
    const phone = raw.trim().replace(/[\s.\-()]/gu, "")
    if (!/^\+?\d+$/u.test(phone)) return false
    const digits = phone.replace(/\D/gu, "")
    if (phone.startsWith("+") || phone.startsWith("00")) return /^[1-9]\d{7,14}$/u.test(digits.replace(/^00/u, ""))
    return phone.startsWith("0") || (phone.startsWith("84") && phone.length >= 11 && phone.length <= 12)
}

/** The four small forms of the personal Telegram wizard, each with its zod schema and catalog messages. */
export const useTelegramUserForm = (start: TelegramConsentStart) => {
    const t = useTranslations("connectorTelegramUser")
    const schemas = useMemo(
        () => ({
            consent: z.object({
                name: z.string().trim().min(1, t("errName")),
                consent: z.boolean().refine((value) => value, t("errConsent")),
            }),
            phone: z.object({ phone: z.string().refine(isPhone, t("errPhone")) }),
            code: z.object({
                code: z.string().refine((value) => {
                    const digits = value.replace(/\D/gu, "").length
                    return digits >= 4 && digits <= 8
                }, t("errCode")),
            }),
            password: z.object({ password: z.string().min(1, t("errPassword")) }),
        }),
        [t],
    )
    const consent = useForm<TelegramConsentValues>({
        resolver: zodResolver(schemas.consent),
        defaultValues: { name: start.name, consent: start.consent },
        mode: "onChange",
    })
    const phone = useForm<TelegramPhoneValues>({
        resolver: zodResolver(schemas.phone),
        defaultValues: { phone: "" },
        mode: "onChange",
    })
    const code = useForm<TelegramCodeValues>({
        resolver: zodResolver(schemas.code),
        defaultValues: { code: "" },
        mode: "onChange",
    })
    const password = useForm<TelegramPasswordValues>({
        resolver: zodResolver(schemas.password),
        defaultValues: { password: "" },
        mode: "onChange",
    })
    return { consent, phone, code, password }
}
