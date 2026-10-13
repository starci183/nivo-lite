import { useTranslations } from "next-intl"
import { useCallback } from "react"

/** The sentence of a failure: the server answers with the catalog key of its sentence (namespace connections) and this reads it. */
export const useChannelReason = (): ((key: string) => string) => {
    const t = useTranslations("connections")
    return useCallback((key: string) => t(key), [t])
}
