"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { z } from "zod"

/** The trimmed text rule of an agent chat field: at most `limit` characters, else the named message. */
export const useAgentChatLimitedTextForm = (
    limit: number,
    tooLongKey: "messageTooLong" | "visitorNameTooLong",
): z.ZodString => {
    const t = useTranslations("agentChat")
    return useMemo(() => z.string().trim().max(limit, t(tooLongKey)), [limit, t, tooLongKey])
}
