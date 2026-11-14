import type { SlotLabels } from "@nivo-lite/agent-sdk/client"
import { useTranslations } from "next-intl"

/** Resolves the shared data-status copy once, adding the slot's own empty sentence. */
export const useSlotLabels = () => {
    const t = useTranslations("slot")
    return (empty: string): SlotLabels => ({
        empty,
        forbidden: t("forbidden"),
        error: t("error"),
        retry: t("retry"),
    })
}
