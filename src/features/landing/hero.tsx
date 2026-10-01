import { Button } from "@starci/grammar/common";
import { getLocale, getT } from "@/i18n/server";
import { landing } from "@/i18n/dict/landing";
import { BrowserFrame } from "./BrowserFrame";
import { LANDING_OFFER } from "./offer";
import {
  EYEBROW,
  EYEBROW_DOT,
  H1,
  H1_ACCENT,
  HERO,
  HERO_ACTIONS,
  HERO_COPY,
  HERO_GLOW,
  HERO_NOTE,
  HERO_SHOT,
  LEAD,
  TAGLINE,
} from "./classNames";

/** Hero: promise, calls to action and one large real screenshot of the Overview. */
export const LandingHero = async () => {
  const [t, locale] = await Promise.all([getT(landing), getLocale()]);
  return (
    <section className={HERO} aria-labelledby="landing-h1">
      <div className={HERO_GLOW} aria-hidden="true" />
      <div className={HERO_COPY}>
        <span className={EYEBROW}>
          <span className={EYEBROW_DOT} />
          {t("heroEyebrow")}
        </span>
        <h1 id="landing-h1" className={H1}>
          {t("heroLine1")}
          <span className={H1_ACCENT}>{t("heroLine2")}</span>
        </h1>
        <p className={`${LEAD} max-w-2xl`}>{t("heroLead")}</p>
        <div className={HERO_ACTIONS}>
          <div className="w-full sm:w-auto">
            <Button variant="primary" size="lg" width="fill" href={LANDING_OFFER.ctaHref}>
              {t("heroCta")}
            </Button>
          </div>
          <div className="w-full sm:w-auto">
            <Button variant="secondary" size="lg" width="fill" href="#product">
              {t("heroSecondary")}
            </Button>
          </div>
        </div>
        <p className={HERO_NOTE}>{t("heroNote", { days: LANDING_OFFER.trialDays })}</p>
        <p className={TAGLINE}>{t("tagline")}</p>
      </div>
      <div className={HERO_SHOT}>
        <BrowserFrame
          src={`/images/landing/${locale}/overview.png`}
          alt={t("shotOverview")}
          label={t("demoLabel")}
          width={1440}
          height={830}
          priority
        />
      </div>
    </section>
  );
};
