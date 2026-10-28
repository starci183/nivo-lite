"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { zaloFailureKeyOf } from "@/modules/failure"

/**
 * Words a Zalo failure for the reader: the `zalo` catalog sentence of the refusal's capability code (or of a send failure term),
 * else the back end message the failure arrived with.
 */
export const useZaloFailureLabel = () => {
    const t = useTranslations("zalo")
    return useCallback(
        (code: string | undefined, fallback: string): string => {
            const key = zaloFailureKeyOf(code)
            return key === undefined ? fallback : t(key)
        },
        [t],
    )
}
