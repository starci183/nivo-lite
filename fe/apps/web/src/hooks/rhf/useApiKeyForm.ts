"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { z } from "zod"

/** The shortest name a new API key may have. */
const API_KEY_NAME_MIN = 2

/** The values of the create API key form. */
export interface ApiKeyValues {
    name: string
    /** What the key is for: an MCP key for AI clients (the default) or a public API key. */
    kind: "mcp" | "public_api"
    /** The agent the key names; `""` is none (the default). */
    agentId: string
}

/** The create API key form: a zod schema whose message comes from the `developers` catalog, validated before the mutation runs. */
export const useApiKeyForm = (): UseFormReturn<ApiKeyValues> => {
    const t = useTranslations("developers")
    const schema = useMemo(
        () =>
            z.object({
                name: z.string().trim().min(API_KEY_NAME_MIN, t("keyNameHint")),
                kind: z.enum(["mcp", "public_api"]),
                agentId: z.string(),
            }),
        [t],
    )
    return useForm<ApiKeyValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: "", kind: "mcp", agentId: "" },
        mode: "onChange",
    })
}
