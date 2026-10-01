"use client"

import { Badge, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { promoAds } from "@/i18n/dict/promoAds"
import { FOUNDING_OFFER, isOfferLive } from "@/lib/promo"
import { SUMMARY_LIST, SUMMARY_ROW, SUMMARY_VALUE } from "./classNames"

type CheckoutSummaryProps = { readonly moduleName: string }

/** Order summary before "Add to workspace". Only states what is true: no amounts are invented. */
export const CheckoutSummary = ({ moduleName }: CheckoutSummaryProps) => {
  const t = useT(promoAds)
  const rows: ReadonlyArray<{ readonly label: string; readonly value: string }> = [
    { label: t("summaryModule"), value: moduleName },
    { label: t("summaryPlan"), value: t("summaryPlanValue") },
    ...(isOfferLive() ? [{ label: FOUNDING_OFFER.name, value: t("summaryApplied", { percent: FOUNDING_OFFER.percentOff }) }] : []),
    { label: t("summaryStarts"), value: t("summaryToday") },
  ]
  return (
    <SurfaceCard label={t("summaryTitle")} headingLevel={2}>
      <div className={SUMMARY_LIST}>
        {rows.map((row) => (
          <div key={row.label} className={SUMMARY_ROW}>
            <Text size="sm" tone="muted">{row.label}</Text>
            <div className={SUMMARY_VALUE}>
              {row.label === FOUNDING_OFFER.name ? <Badge tone="accent">{row.value}</Badge> : <Text weight="medium">{row.value}</Text>}
            </div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  )
}
