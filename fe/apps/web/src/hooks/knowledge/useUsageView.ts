import { useFormatter, useTranslations } from "next-intl"
import { usageMeterOf } from "@/modules/documents"
import type { UsageView } from "@/modules/documents"

/** The meter of the raw document allowance worded in the viewer's language and number format; nothing until the usage is known. */
export const useUsageView = (
    usage: { readonly usedBytes: number; readonly limitBytes: number } | undefined,
): UsageView | undefined => {
    const t = useTranslations("knowledge")
    const formatter = useFormatter()
    return usage === undefined
        ? undefined
        : usageMeterOf({ label: t("usageLabel"), valueLabel: (mb) => t("usageValue", mb), formatter, usage })
}
