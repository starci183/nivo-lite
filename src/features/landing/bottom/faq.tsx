import { PageContainer, Region, SectionHeader } from "@starci/grammar/common";
import { getLocale } from "@/i18n/server";
import { translator } from "@/i18n/core";
import { landingBottom } from "@/i18n/dict/landingBottom";
import { ANCHOR } from "../classNames";
import { FOUNDING_OFFER, LANDING_OFFER } from "../offer";
import { FaqList, type FaqEntry } from "./faq-list";
import { formatDate, formatVnd } from "./format";
import * as c from "./classNames";

/** id="faq": two-column FAQ with honest answers. Numbers and dates come from offer.ts and promo.ts. */
export const LandingFaq = async () => {
  const locale = await getLocale();
  const t = translator(landingBottom, locale);
  const entry = (n: number, vars?: Record<string, string | number>): FaqEntry => ({
    id: `q${n}`,
    question: t(`q${n}` as "q1"),
    answer: t(`a${n}` as "a1", vars),
  });
  const terms = { percent: FOUNDING_OFFER.percentOff, cap: FOUNDING_OFFER.cap, date: formatDate(FOUNDING_OFFER.endsAt, locale) };
  const price = { plan: LANDING_OFFER.planName, price: formatVnd(LANDING_OFFER.startPriceVnd, locale), days: LANDING_OFFER.trialDays };
  const left = [entry(1), entry(2), entry(3), entry(4, terms)];
  const right = [entry(5), entry(6), entry(7, price), entry(8)];

  return (
    <Region id="faq" label={t("faqAria")} className={ANCHOR}>
      <PageContainer measure="product">
        <div className={c.SECTION_STACK}>
          <SectionHeader eyebrow={t("faqEyebrow")} title={t("faqTitle")} />
          <div className={c.FAQ_GRID}>
            <FaqList label={t("faqListLeft")} entries={left} defaultOpenId="q1" />
            <FaqList label={t("faqListRight")} entries={right} />
          </div>
        </div>
      </PageContainer>
    </Region>
  );
};
