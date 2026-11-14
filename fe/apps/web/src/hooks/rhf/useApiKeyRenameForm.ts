"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { z } from "zod"

/** The shortest name an API key may have. */
const API_KEY_NAME_MIN = 2

/** The values of the rename API key form. */
export interface ApiKeyRenameValues {
    name: string
}

/** The rename API key form: the same shortest name as the create form. */
export const useApiKeyRenameForm = (): UseFormReturn<ApiKeyRenameValues> => {
    const t = useTranslations("developers")
    const schema = useMemo(() => z.object({ name: z.string().trim().min(API_KEY_NAME_MIN, t("keyNameHint")) }), [t])
    return useForm<ApiKeyRenameValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: "" },
        mode: "onChange",
    })
}
