import { Button } from "@starci/grammar/common";
import { getLocale } from "@/i18n/server";
import { translator } from "@/i18n/core";
import { landingBottom } from "@/i18n/dict/landingBottom";
import { isOfferLive } from "@/lib/promo";
import { FOUNDING_OFFER, foundingPriceVnd, LANDING_OFFER } from "../offer";
import { OfferCountdown } from "./countdown";
import { Eyebrow } from "./eyebrow";
import { formatDate, formatVnd } from "./format";
import * as c from "./classNames";

const ICONS = {
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5M12 17h.01" />
    </>
  ),
  approver: (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M3 20c0-3.5 3-6 7-6M15 17l2 2 4-4" />
    </>
  ),
} as const;

type FactProps = { readonly icon: keyof typeof ICONS; readonly title: string; readonly text: string; readonly className: string };

const Fact = ({ icon, title, text, className }: FactProps) => (
  <div className={className}>
    <svg viewBox="0 0 24 24" aria-hidden="true" className={c.FACT_ICON} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[icon]}
    </svg>
    <p className={c.FACT_TITLE}>{title}</p>
    <p className={c.FACT_TEXT}>{text}</p>
  </div>
);

/** id="founding": the "clear scope" facts plus the NIVO Start price tile merged with the Founding 50 campaign. */
export const LandingOffer = async () => {
  const locale = await getLocale();
  const t = translator(landingBottom, locale);
  const live = isOfferLive();
  const date = formatDate(FOUNDING_OFFER.endsAt, locale);
  const card = LANDING_OFFER.cardRequired ? t("fact2Card") : t("fact2NoCard");
  const factEdge = `${c.FACT} md:last:border-b-0`;

  return (
    <section id="founding" aria-label={t("offerAria")} className={c.SECTION}>
      <div className={c.GRID}>
        <div className={c.HEAD_ROW}>
          <Eyebrow>{t("offerEyebrow")}</Eyebrow>
          <h2 className={c.H2}>{t("offerTitle")}</h2>
        </div>
        <div className={c.BENTO}>
          <div className={`${c.FACTS_COL} order-2 md:order-1`}>
            <Fact icon="target" title={t("fact1Title")} text={t("fact1Text")} className={factEdge} />
            <Fact icon="calendar" title={t("fact2Title", { days: LANDING_OFFER.trialDays })} text={t("fact2Text", { card })} className={factEdge} />
          </div>

          <div className={`${c.TILE} order-1 border-b border-[#e2e8f0] md:order-2 md:border-x md:border-b-0`}>
            <img className={c.TILE_MASCOT} src="/images/promo/mascot-offer.png" alt="" />
            <div className={c.TILE_TOP}>
              <p className={c.TILE_LABEL}>{t("priceLabel")}</p>
              {live ? <span className={c.TILE_TAG}>{t("foundingTag")}</span> : null}
            </div>
            <div className={c.TILE_BODY}>
              <p className={c.TILE_PLAN}>{LANDING_OFFER.planName}</p>
              {live ? (
                <>
                  <p className={c.TILE_OLD}>{formatVnd(LANDING_OFFER.startPriceVnd, locale)}</p>
                  <p className={c.TILE_NEW_ROW}>
                    <span className={c.TILE_NEW}>{formatVnd(foundingPriceVnd(), locale)}</span>
                    <span className={c.TILE_UNIT}>{t("perMonth")}</span>
                  </p>
                  <p className={c.TILE_NOTE}>{t("foundingPriceLabel")}</p>
                  <p className={c.TILE_SAVING}>{t("foundingSaving", { percent: FOUNDING_OFFER.percentOff, cap: FOUNDING_OFFER.cap })}</p>
                </>
              ) : (
                <>
                  <p className={c.TILE_NEW_ROW}>
                    <span className={c.TILE_NEW}>{formatVnd(LANDING_OFFER.startPriceVnd, locale)}</span>
                    <span className={c.TILE_UNIT}>{t("perMonth")}</span>
                  </p>
                  <p className={c.TILE_NOTE}>{t("priceAfterTrial")}</p>
                </>
              )}
            </div>
            <div className={c.TILE_FOOT}>
              {live ? (
                <>
                  <OfferCountdown date={date} />
                  <p className={c.TILE_ENDS}>{t("offerEnds", { date })}</p>
                </>
              ) : null}
              <div className={c.TILE_CTA}>
                <Button variant="primary" size="lg" width="fill" href={LANDING_OFFER.ctaHref}>
                  {t("offerCta")}
                </Button>
              </div>
              <p className={c.TILE_FINE}>{t("offerFine")}</p>
            </div>
          </div>

          <div className={`${c.FACTS_COL} order-3`}>
            <Fact icon="question" title={t("fact3Title")} text={t("fact3Text")} className={c.FACT} />
            <Fact icon="approver" title={t("fact4Title")} text={t("fact4Text")} className={`${c.FACT} border-b-0`} />
          </div>
        </div>
      </div>
    </section>
  );
};
