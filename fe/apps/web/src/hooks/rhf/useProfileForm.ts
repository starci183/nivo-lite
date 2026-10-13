"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { NAME_MAX, NAME_MIN } from "@/hooks/account"

/** The values of the display-name form. */
export interface ProfileValues {
    name: string
}

/** The display-name form: a zod schema whose messages come from the `account` catalog; `name` is the saved name it starts from. */
export const useProfileForm = (name: string) => {
    const t = useTranslations("account")
    const schema = useMemo(
        () => z.object({ name: z.string().trim().min(NAME_MIN, t("errName")).max(NAME_MAX, t("errName")) }),
        [t],
    )
    return useForm<ProfileValues>({
        resolver: zodResolver(schema),
        values: { name },
        resetOptions: { keepDirtyValues: true },
        mode: "onSubmit",
    })
}
