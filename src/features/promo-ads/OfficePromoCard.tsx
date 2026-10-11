"use client"

import { Button, CloseButton, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { promoAds } from "@/i18n/dict/promoAds"
import { isOfferLive } from "@/lib/promo"
import { PROMO_ACTIONS, PROMO_COPY, PROMO_ROW } from "./classNames"
import { useDismissed } from "./useDismissed"

type OfficePromoCardProps = { readonly hasChatbot: boolean }

/**
 * System-style card at the top of the Office conversation while no Chatbot exists. Dismissible. A Grammar
 * `SurfaceCard` nested in the conversation surface (BOUNDARY-5 case-1) replaces the hand-drawn bordered box; the
 * mascot was removed (no mascot in chrome or rows).
 */
export const OfficePromoCard = ({ hasChatbot }: OfficePromoCardProps) => {
  const t = useT(promoAds)
  const { ready, dismissed, dismiss } = useDismissed("office-chatbot")
  if (hasChatbot || !ready || dismissed) return null
  return (
    <div role="note">
      <SurfaceCard depth="nested">
        <div className={PROMO_ROW}>
          <div className={PROMO_COPY}>
            <Text size="xs">{t("officeTag")}</Text>
            <Text weight="medium">{t("officeBody")}</Text>
            {isOfferLive() ? <Text size="sm" tone="muted">{t("officeOffer")}</Text> : null}
          </div>
          <div className={PROMO_ACTIONS}>
            <Button variant="outline" size="sm" href="/modules/new?module=chatbot">{t("addChatbot")}</Button>
            <CloseButton label={t("dismiss")} size="sm" onPress={dismiss} />
          </div>
        </div>
      </SurfaceCard>
    </div>
  )
}
