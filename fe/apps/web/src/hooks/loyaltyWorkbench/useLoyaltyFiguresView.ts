import type { LoyaltyPanelInput } from "@/hooks/loyalty"
import { toast } from "@/modules/toast"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The view `useLoyaltyFiguresView` returns. */
export interface LoyaltyFiguresView {
    props: {
        label: string
        slot: DataSlot<
            {
                id: string
                value: string
                meta: string
            }[]
        >
        captions: {
            id: string
            term: string
        }[]
        labels: SlotLabels
    }
    on: {
        retry: () => void
    }
}

/** The connected figures strip of the loyalty workbench: active members, points issued, redemptions and members at risk. */
export const useLoyaltyFiguresView = (input: LoyaltyPanelInput): LoyaltyFiguresView => {
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const retry = () => {
        input.read.mutate().catch(() => toast.danger(slotLabels("").error))
    }
    const board = input.read
    const { data } = board
    const f = data?.figures
    const items = [
        {
            id: "active",
            term: t("metricMembers"),
            value: f === undefined ? "" : format.number(f.activeMembers),
            meta: f === undefined ? "" : t("metricMembersBasis", { n: format.number(f.members) }),
        },
        {
            id: "issued",
            term: t("metricIssued"),
            value: f === undefined ? "" : t("points", { n: format.number(f.pointsIssued30d) }),
            meta: t("metricIssuedBasis"),
        },
        {
            id: "redemptions",
            term: t("metricRedemptions"),
            value: f === undefined ? "" : format.number(f.redemptions30d),
            meta: f === undefined ? "" : t("metricRedemptionsBasis", { n: format.number(f.pointsRedeemed30d) }),
        },
        {
            id: "atRisk",
            term: t("metricAtRisk"),
            value: f === undefined ? "" : format.number(f.atRisk),
            meta: t("metricAtRiskBasis"),
        },
    ]
    return {
        props: {
            label: t("metricsAria"),
            slot: mapSlot(slotOfSwr(board), () => items.map(({ id, value, meta }) => ({ id, value, meta }))),
            captions: items.map(({ id, term }) => ({ id, term })),
            labels: slotLabels(t("loadFailedTitle")),
        },
        on: {
            retry: retry,
        },
    }
}
