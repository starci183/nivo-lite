"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useT } from "@/i18n/client"
import { promoAds } from "@/i18n/dict/promoAds"
import { WELCOME, WELCOME_ACTIONS, WELCOME_ART, WELCOME_CLOSE, WELCOME_COPY, WELCOME_GRID, WELCOME_LINK, WELCOME_PRIMARY, WELCOME_TEXT, WELCOME_TITLE } from "./classNames"

type WelcomeBannerProps = { readonly agentId: string }

/** Post-purchase celebration: calm, dismissible, shown only with ?welcome=1 by a Founding 50 member. */
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
    <section className={WELCOME} aria-label={t("welcomeAria")}>
      <button type="button" className={WELCOME_CLOSE} onClick={onClose} aria-label={t("welcomeClose")}>
        <span aria-hidden="true">×</span>
      </button>
      <div className={WELCOME_GRID}>
        <div className={WELCOME_COPY}>
          <h2 className={WELCOME_TITLE}>{t("welcomeTitle")}</h2>
          <p className={WELCOME_TEXT}>{t("welcomeText")}</p>
          <div className={WELCOME_ACTIONS}>
            <Link className={WELCOME_PRIMARY} href={`/modules/${agentId}/chat?tab=customer`}>{t("welcomeTest")}</Link>
            <Link className={WELCOME_LINK} href="/chat">{t("welcomeOffice")}</Link>
          </div>
        </div>
        <img className={WELCOME_ART} src="/images/promo/mascot-celebrate.png" alt="" />
      </div>
    </section>
  )
}
