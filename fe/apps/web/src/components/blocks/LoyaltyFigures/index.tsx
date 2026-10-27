"use client"

import { useFormatter, useTranslations } from "next-intl"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQueryLoyaltyBoardSwr } from "@/hooks/swr"
import { LoyaltyFiguresBase } from "./component"

/** The connected figures strip of the loyalty workbench: active members, points issued, redemptions and members at risk. */
export const LoyaltyFigures = () => {
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const board = useQueryLoyaltyBoardSwr()
    const { data } = board
    const f = data?.figures
    const items = [
        {
            id: "active",
            term: t("metricMembers"),
            description: f === undefined ? "" : format.number(f.activeMembers),
            meta: f === undefined ? "" : t("metricMembersBasis", { n: format.number(f.members) }),
        },
        {
            id: "issued",
            term: t("metricIssued"),
            description: f === undefined ? "" : t("points", { n: format.number(f.pointsIssued30d) }),
            meta: t("metricIssuedBasis"),
        },
        {
            id: "redemptions",
            term: t("metricRedemptions"),
            description: f === undefined ? "" : format.number(f.redemptions30d),
            meta: f === undefined ? "" : t("metricRedemptionsBasis", { n: format.number(f.pointsRedeemed30d) }),
        },
        {
            id: "atRisk",
            term: t("metricAtRisk"),
            description: f === undefined ? "" : format.number(f.atRisk),
            meta: t("metricAtRiskBasis"),
        },
    ]
    return (
        <LoyaltyFiguresBase
            props={{
                label: t("metricsAria"),
                slot: slotOfSwr({
                    data: f === undefined ? undefined : items,
                    error: board.error,
                    isLoading: board.isLoading,
                }),
                labels: slotLabels(t("loadFailedTitle")),
                placeholder: items,
            }}
            on={{
                retry: () => {
                    void board.mutate()
                },
            }}
        />
    )
}
