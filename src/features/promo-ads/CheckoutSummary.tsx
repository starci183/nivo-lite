"use client"

import { Badge, DescriptionList, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { promoAds } from "@/i18n/dict/promoAds"
import { FOUNDING_OFFER, isOfferLive } from "@/lib/promo"

type CheckoutSummaryProps = { readonly moduleName: string }

/**
 * Order summary before "Add to workspace". Only states what is true: no amounts are invented. Term/value pairs are
 * Grammar's `DescriptionList` (divided columns) instead of hand-drawn bordered rows; the applied campaign is a Badge.
 */
export const CheckoutSummary = ({ moduleName }: CheckoutSummaryProps) => {
  const t = useT(promoAds)
  const rows: ReadonlyArray<{ readonly id: string; readonly label: string; readonly value: string; readonly isOffer?: boolean }> = [
    { id: "module", label: t("summaryModule"), value: moduleName },
    { id: "plan", label: t("summaryPlan"), value: t("summaryPlanValue") },
    ...(isOfferLive() ? [{ id: "offer", label: FOUNDING_OFFER.name, value: t("summaryApplied", { percent: FOUNDING_OFFER.percentOff }), isOffer: true }] : []),
    { id: "starts", label: t("summaryStarts"), value: t("summaryToday") },
  ]
  return (
    <SurfaceCard label={t("summaryTitle")} headingLevel={2}>
      <DescriptionList
        layout="columns"
        isDivided
        items={rows.map((row) => ({
          id: row.id,
          term: row.label,
          description: row.isOffer === true ? <Badge tone="accent">{row.value}</Badge> : <Text weight="medium">{row.value}</Text>,
        }))}
      />
    </SurfaceCard>
  )
}
