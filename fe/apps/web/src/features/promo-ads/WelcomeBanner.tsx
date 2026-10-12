"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, CloseButton, Heading, Image, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { promoAds } from "@/i18n/dict/promoAds"
import { WELCOME_ACTIONS, WELCOME_COPY, WELCOME_HEAD } from "./classNames"

type WelcomeBannerProps = { readonly agentId: string }

/**
 * Post-purchase celebration: calm, dismissible, shown only with ?welcome=1 by a Founding 50 member. A first-run
 * welcome, so it is the screen's one signature moment: Grammar's ink band with the celebrating unicorn in the
 * decorative artwork slot (DISCIPLINE-3). Links are Grammar `Button href` (CTA-2), dismissal is `CloseButton`.
 * grammar gap: a primary Button on the ink band is accent on accent, so the dominant action takes `secondary`.
 */
export const WelcomeBanner = ({ agentId }: WelcomeBannerProps) => {
  const router = useRouter()
  const t = useT(promoAds)
  const [open, setOpen] = useState(true)
  if (!open) return null
  const onClose = () => {
    setOpen(false)
    router.replace(`/modules/${agentId}/chat`, { scroll: false })
  }
  return (
    <SurfaceCard
      treatment="ink"
      ariaLabel={t("welcomeAria")}
      artwork={<Image src="/images/promo/mascot-celebrate.png" alt="" aspect="auto" fit="contain" />}
    >
      <div className={WELCOME_COPY}>
        <div className={WELCOME_HEAD}>
          <Heading level={2}>{t("welcomeTitle")}</Heading>
          <CloseButton label={t("welcomeClose")} size="sm" onPress={onClose} />
        </div>
        <Text>{t("welcomeText")}</Text>
        <div className={WELCOME_ACTIONS}>
          <Button variant="secondary" href={`/modules/${agentId}/chat?tab=customer`}>{t("welcomeTest")}</Button>
          <Button variant="ghost" href="/chat">{t("welcomeOffice")}</Button>
        </div>
      </div>
    </SurfaceCard>
  )
}
