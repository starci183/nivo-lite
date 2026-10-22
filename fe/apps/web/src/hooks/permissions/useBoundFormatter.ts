"use client"

import { useFormatter, useTranslations } from "next-intl"
import type { RuleUnit } from "@/modules/authority"

/** A bound in the unit of its rule, for the table and the legend: money with its sign, a percentage with its sign, a count plain. */
export const useBoundFormatter = () => {
    const t = useTranslations("permissions")
    const format = useFormatter()
    return (value: number, unit: RuleUnit): string => {
        const text = format.number(value, { maximumFractionDigits: 2 })
        if (unit === "vnd") return t("boundVnd", { value: text })
        return unit === "percent" ? t("boundPercent", { value: text }) : t("boundCount", { value: text })
    }
}
