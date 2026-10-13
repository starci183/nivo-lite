"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { PASSWORD_MIN_LENGTH } from "@/hooks/auth"

/** The values of the reset-password form. */
export interface ResetValues {
    password: string
    confirm: string
}

/** The reset-password form: long enough and confirmed; messages come from the `auth` catalog. */
export const useResetForm = () => {
    const t = useTranslations("auth")
    const schema = useMemo(
        () =>
            z
                .object({ password: z.string().min(PASSWORD_MIN_LENGTH, t("errPasswordShort")), confirm: z.string() })
                .refine((values) => values.confirm === values.password, {
                    path: ["confirm"],
                    message: t("errPasswordMismatch"),
                }),
        [t],
    )
    return useForm<ResetValues>({
        resolver: zodResolver(schema),
        defaultValues: { password: "", confirm: "" },
        mode: "onSubmit",
    })
}
