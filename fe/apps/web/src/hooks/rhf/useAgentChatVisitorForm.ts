"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { UseFormReturn } from "react-hook-form"
import { useAgentChatLimitedTextForm } from "./useAgentChatLimitedTextForm"

type UseAgentChatVisitorFormResult = UseFormReturn<{
    visitorName: string
}>

/** Validates the optional test customer name before opening a conversation. */
export const useAgentChatVisitorForm = (): UseAgentChatVisitorFormResult => {
    const visitorName = useAgentChatLimitedTextForm(80, "visitorNameTooLong")
    const schema = useMemo(() => z.object({ visitorName }), [visitorName])
    return useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { visitorName: "" } })
}
