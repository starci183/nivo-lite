"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { UseFormReturn } from "react-hook-form"
import { useAgentChatLimitedTextForm } from "./useAgentChatLimitedTextForm"

type UseAgentChatMessageFormResult = UseFormReturn<{
    body: string
}>

/** Validates the message before its queued mutation runs. */
export const useAgentChatMessageForm = (): UseAgentChatMessageFormResult => {
    const body = useAgentChatLimitedTextForm(4000, "messageTooLong")
    const schema = useMemo(() => z.object({ body }), [body])
    return useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { body: "" } })
}
