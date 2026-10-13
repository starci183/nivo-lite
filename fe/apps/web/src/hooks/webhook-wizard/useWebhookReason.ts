import { useTranslations } from "next-intl"
import { useCallback } from "react"

/** The sentence of a webhook failure: the server answers with the catalog key of its sentence (namespace webhookWizard) and this reads it. */
export const useWebhookReason = (): ((key: string) => string) => {
    const t = useTranslations("webhookWizard")
    return useCallback((key: string) => t(key), [t])
}
