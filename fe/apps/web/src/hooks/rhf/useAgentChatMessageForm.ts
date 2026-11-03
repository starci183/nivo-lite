"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { UseFormReturn } from "react-hook-form"

type UseAgentChatMessageFormResult = UseFormReturn<{
    body: string
}>

/** Validates the message before its queued mutation runs. */
export const useAgentChatMessageForm = (): UseAgentChatMessageFormResult => {
    const t = useTranslations("agentChat")
    const schema = useMemo(() => z.object({ body: z.string().trim().max(4000, t("messageTooLong")) }), [t])
    return useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { body: "" } })
}
