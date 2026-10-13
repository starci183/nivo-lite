"use client"

import { useFormatter, useTranslations } from "next-intl"
import { findTier } from "@/hooks/loyalty"
import type { LoyaltyConfigType } from "@/modules/api"
import type { PromoSegment } from "./loyaltyPromo.shared"

/** The words that describe a segment ("tier Gold or Silver, not back for 45 days"), built from the `loyalty` catalog and the programme's tier names. */
export const useSegmentLabel = (config: LoyaltyConfigType) => {
    const t = useTranslations("loyalty")
    const format = useFormatter()
    return (segment: PromoSegment): string => {
        const parts: Array<string> = []
        if (segment.tiers.length > 0) {
            const names = segment.tiers.map((key) => findTier(config, key)?.name ?? key)
            parts.push(t("segLabelTiers", { tiers: format.list(names, { type: "disjunction" }) }))
        }
        if (segment.inactiveDays > 0) parts.push(t("segLabelInactive", { days: segment.inactiveDays }))
        if (segment.birthdayThisMonth) parts.push(t("segLabelBirthday"))
        if (segment.minSpendVnd > 0)
            parts.push(
                t("segLabelSpend", {
                    value: format.number(segment.minSpendVnd, {
                        style: "currency",
                        currency: "VND",
                        maximumFractionDigits: 0,
                    }),
                }),
            )
        return parts.length === 0 ? t("segLabelAll") : format.list(parts, { type: "unit" })
    }
}
