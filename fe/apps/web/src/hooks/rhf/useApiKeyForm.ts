"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { API_KEY_NAME_MIN } from "@/hooks/developers"

/** The values of the create API key form. */
export interface ApiKeyValues {
    name: string
}

/** The create API key form: a zod schema whose message comes from the `developers` catalog, validated before the mutation runs. */
export const useApiKeyForm = () => {
    const t = useTranslations("developers")
    const schema = useMemo(
        () => z.object({ name: z.string().trim().min(API_KEY_NAME_MIN, t("keyNameHint")) }),
        [t],
    )
    return useForm<ApiKeyValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: "" },
        mode: "onChange",
    })
}
