"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { UseFormReturn } from "react-hook-form"

type UseAgentChatVisitorFormResult = UseFormReturn<{
    visitorName: string
}>

/** Validates the optional test customer name before opening a conversation. */
export const useAgentChatVisitorForm = (): UseAgentChatVisitorFormResult => {
    const t = useTranslations("agentChat")
    const schema = useMemo(() => z.object({ visitorName: z.string().trim().max(80, t("visitorNameTooLong")) }), [t])
    return useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { visitorName: "" } })
}
