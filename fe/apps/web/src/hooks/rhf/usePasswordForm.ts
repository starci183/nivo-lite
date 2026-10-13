"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { PASSWORD_MAX, PASSWORD_MIN } from "@/hooks/account"

/** The values of the change-password form. */
export interface PasswordValues {
    current: string
    next: string
    confirm: string
}

/** The change-password form: filled, long enough, confirmed and different from the current one; messages come from the `account` catalog. */
export const usePasswordForm = () => {
    const t = useTranslations("account")
    const schema = useMemo(
        () =>
            z
                .object({
                    current: z.string().min(1, t("errCurrent")),
                    next: z.string().min(PASSWORD_MIN, t("errMin")).max(PASSWORD_MAX, t("errMin")),
                    confirm: z.string(),
                })
                .refine((values) => values.next === values.confirm, { path: ["confirm"], message: t("errMatch") })
                .refine((values) => values.next !== values.current, { path: ["next"], message: t("errSameAsOld") }),
        [t],
    )
    return useForm<PasswordValues>({
        resolver: zodResolver(schema),
        defaultValues: { current: "", next: "", confirm: "" },
        mode: "onSubmit",
    })
}
