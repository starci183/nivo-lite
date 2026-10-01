"use client"

import { Button, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { promoAds } from "@/i18n/dict/promoAds"
import { isOfferLive } from "@/lib/promo"
import { PROMO_ACTIONS, PROMO_COPY, PROMO_MASCOT, PROMO_ROW, SR_ONLY } from "./classNames"
import { useChatbotState } from "./useChatbotState"
import { useDismissed } from "./useDismissed"

/** Quiet row at the top of the leads list card while no Chatbot exists. Dismissible. */
export const LeadsPromoRow = () => {
  const t = useT(promoAds)
  const chatbot = useChatbotState()
  const { ready, dismissed, dismiss } = useDismissed("leads-chatbot")
  if (chatbot === null || chatbot.hasChatbot || !ready || dismissed) return null
  const live = isOfferLive()
  return (
    <div className={PROMO_ROW} role="note">
      <img className={PROMO_MASCOT} src="/images/promo/mascot-offer.png" alt="" />
      <div className={PROMO_COPY}>
        <Text weight="medium">{t("leadsRowTitle")}</Text>
        <Text size="sm" tone="muted">{live ? t("leadsRowLive") : t("leadsRowPlain")}</Text>
      </div>
      <div className={PROMO_ACTIONS}>
        <Button variant="outline" size="sm" href="/modules/new?module=chatbot">{t("seeChatbot")}</Button>
        <Button variant="ghost" size="sm" onPress={dismiss}>
          <span aria-hidden="true">×</span>
          <span className={SR_ONLY}>{t("dismiss")}</span>
        </Button>
      </div>
    </div>
  )
}
