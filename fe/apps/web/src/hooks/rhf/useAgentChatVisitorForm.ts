"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** Validates the optional test customer name before opening a conversation. */
export const useAgentChatVisitorForm = () => {
    const t = useTranslations("agentChat")
    const schema = useMemo(() => z.object({ visitorName: z.string().trim().max(80, t("visitorNameTooLong")) }), [t])
    return useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { visitorName: "" } })
}
