"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { promo } from "@/i18n/dict/promo";
import { isOfferLive } from "@/lib/promo";
import * as c from "./cardClassNames";

const STORAGE_KEY = "nivo.promo.sidebar-ad.dismissed";

export type SidebarAdProps = {
  readonly hasChatbot: boolean;
  readonly isFoundingMember: boolean;
  readonly ctaHref?: string;
};

/**
 * Compact sidebar card. Before the Chatbot is bought it is a dismissible Founding 50 ad; afterwards a quiet
 * "Founding member" card (only claiming the locked price when the purchase really happened inside the offer window).
 */
export const SidebarAd = ({ hasChatbot, isFoundingMember, ctaHref = "/modules/new?module=chatbot" }: SidebarAdProps) => {
  const t = useT(promo);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* storage unavailable: keep showing */
    }
  }, []);

  if (hasChatbot) {
    if (!isFoundingMember) return null;
    return (
      <div className={c.MEMBER} role="note" aria-label={t("foundingMember")}>
        <p className={c.MEMBER_HEAD}>
          <span className={c.DOT} aria-hidden="true" />
          {t("foundingMember")}
        </p>
        <p className={c.MEMBER_TEXT}>{t("priceLocked")}</p>
      </div>
    );
  }
  if (dismissed || !isOfferLive()) return null;

  return (
    <aside className={c.AD} aria-label={t("adAria")}>
      <img className={c.AD_ART} src="/images/promo/mascot-chat.png" alt="" />
      <button
        type="button"
        className={c.AD_CLOSE}
        aria-label={t("adDismiss")}
        onClick={() => {
          setDismissed(true);
          try {
            window.localStorage.setItem(STORAGE_KEY, "1");
          } catch {
            /* ignore */
          }
        }}
      >
        <span aria-hidden="true">×</span>
      </button>
      <div className={c.AD_BODY}>
        <p className={c.AD_TITLE}>{t("adTitle")}</p>
        <p className={c.AD_TEXT}>{t("adText")}</p>
        <span className={c.AD_OFF}>{t("adOff")}</span>
        <Link className={c.AD_CTA} href={ctaHref}>
          {t("addChatbot")}
        </Link>
      </div>
    </aside>
  );
};
