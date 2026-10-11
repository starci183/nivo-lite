"use client"

import { Button, CloseButton, Divider, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { promoAds } from "@/i18n/dict/promoAds"
import { isOfferLive } from "@/lib/promo"
import { PROMO_ACTIONS, PROMO_BLOCK, PROMO_COPY, PROMO_ROW } from "./classNames"
import { useChatbotState } from "./useChatbotState"
import { useDismissed } from "./useDismissed"

/**
 * Quiet row at the top of the leads list card while no Chatbot exists. Dismissible through Grammar's `CloseButton`;
 * its closing seam is a `Divider` (BOUNDARY-1). The mascot was removed: rows never carry the mascot (brand rule,
 * DISCIPLINE-3).
 */
export const LeadsPromoRow = () => {
  const t = useT(promoAds)
  const chatbot = useChatbotState()
  const { ready, dismissed, dismiss } = useDismissed("leads-chatbot")
  if (chatbot === null || chatbot.hasChatbot || !ready || dismissed) return null
  const live = isOfferLive()
  return (
    <div className={PROMO_BLOCK} role="note">
      <div className={PROMO_ROW}>
        <div className={PROMO_COPY}>
          <Text weight="medium">{t("leadsRowTitle")}</Text>
          <Text size="sm" tone="muted">{live ? t("leadsRowLive") : t("leadsRowPlain")}</Text>
        </div>
        <div className={PROMO_ACTIONS}>
          <Button variant="outline" size="sm" href="/modules/new?module=chatbot">{t("seeChatbot")}</Button>
          <CloseButton label={t("dismiss")} size="sm" onPress={dismiss} />
        </div>
      </div>
      <Divider semantics="presentation" />
    </div>
  )
}
