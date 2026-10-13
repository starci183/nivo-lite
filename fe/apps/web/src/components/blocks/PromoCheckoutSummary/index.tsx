"use client"

import { useTranslations } from "next-intl"
import { usePromoOffer } from "@/hooks/promo"
import { PromoCheckoutSummaryBase } from "./component"

/** Props of {@link PromoCheckoutSummary}. */
export interface PromoCheckoutSummaryProps {
    /** The name of the agent being added. */
    readonly moduleName: string
}

/** The connected order summary: states only what is true, and the Founding 50 line only while the offer is live. */
export const PromoCheckoutSummary = (props: PromoCheckoutSummaryProps) => {
    const t = useTranslations("promoAds")
    const campaign = usePromoOffer()
    const offerRows = campaign.live
        ? [
              {
                  id: "offer",
                  label: campaign.name,
                  value: t("summaryApplied", { percent: campaign.percentOff }),
                  isOffer: true,
              },
          ]
        : []
    return (
        <PromoCheckoutSummaryBase
            props={{
                title: t("summaryTitle"),
                rows: [
                    { id: "module", label: t("summaryModule"), value: props.moduleName },
                    { id: "plan", label: t("summaryPlan"), value: t("summaryPlanValue") },
                    ...offerRows,
                    { id: "starts", label: t("summaryStarts"), value: t("summaryToday") },
                ],
            }}
        />
    )
}
