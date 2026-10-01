"use client"

import { Button, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { promoAds } from "@/i18n/dict/promoAds"
import { isOfferLive } from "@/lib/promo"
import { OFFICE_PROMO, PROMO_ACTIONS, PROMO_COPY, PROMO_MASCOT, SR_ONLY } from "./classNames"
import { useDismissed } from "./useDismissed"

type OfficePromoCardProps = { readonly hasChatbot: boolean }

/** System-style card at the top of the Office conversation while no Chatbot exists. Dismissible. */
export const OfficePromoCard = ({ hasChatbot }: OfficePromoCardProps) => {
  const t = useT(promoAds)
  const { ready, dismissed, dismiss } = useDismissed("office-chatbot")
  if (hasChatbot || !ready || dismissed) return null
  return (
    <div className={OFFICE_PROMO} role="note">
      <img className={PROMO_MASCOT} src="/images/promo/mascot-offer.png" alt="" />
      <div className={PROMO_COPY}>
        <Text size="xs" tone="muted">{t("officeTag")}</Text>
        <Text weight="medium">{t("officeBody")}</Text>
        {isOfferLive() ? <Text size="sm" tone="muted">{t("officeOffer")}</Text> : null}
      </div>
      <div className={PROMO_ACTIONS}>
        <Button variant="outline" size="sm" href="/modules/new?module=chatbot">{t("addChatbot")}</Button>
        <Button variant="ghost" size="sm" onPress={dismiss}>
          <span aria-hidden="true">×</span>
          <span className={SR_ONLY}>{t("dismiss")}</span>
        </Button>
      </div>
    </div>
  )
}
