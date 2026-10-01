"use client";

import { Button } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { promo } from "@/i18n/dict/promo";
import type { WebsiteLeadStats } from "@/features/promo/queries";
import * as c from "./cardClassNames";

export type MissedLeadsInsightProps = {
  readonly hasChatbot: boolean;
  readonly stats: WebsiteLeadStats;
  readonly ctaHref?: string;
};

/** Insight computed from this workspace's website leads; hidden once a Chatbot exists or when there are no website leads. */
export const MissedLeadsInsight = ({ hasChatbot, stats, ctaHref = "/modules/new?module=chatbot" }: MissedLeadsInsightProps) => {
  const t = useT(promo);
  if (hasChatbot || stats.count === 0) return null;
  const waitLabel = (hours: number): string => {
    if (hours < 1) return t("waitUnder1");
    if (hours < 48) return Math.round(hours) === 1 ? t("waitHour") : t("waitHours", { n: Math.round(hours) });
    return t("waitDays", { n: Math.round(hours / 24) });
  };
  return (
    <section className={c.INSIGHT} aria-label={t("insightAria")}>
      <img className={c.INSIGHT_ART} src="/images/promo/mascot-night.png" alt="" />
      <div className={c.INSIGHT_COPY}>
        <p className={c.INSIGHT_EYEBROW}>{t("insightEyebrow")}</p>
        <p className={c.INSIGHT_TITLE}>
          {t(stats.count === 1 ? "insightTitleOne" : "insightTitle", { after: stats.afterHoursCount, count: stats.count })}
        </p>
        <p className={c.INSIGHT_TEXT}>
          {stats.avgWaitHours !== null ? `${t("insightWait", { wait: waitLabel(stats.avgWaitHours) })} ` : ""}
          {t("insightText")}
        </p>
      </div>
      <Button variant="secondary" href={ctaHref}>
        {t("addChatbot")}
      </Button>
    </section>
  );
};
