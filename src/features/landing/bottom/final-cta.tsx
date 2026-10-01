import { Button } from "@starci/grammar/common";
import { getT } from "@/i18n/server";
import { landingBottom } from "@/i18n/dict/landingBottom";
import { NivoLogo } from "@/components/brand/NivoLogo";
import { LANDING_OFFER } from "../offer";
import * as c from "./classNames";

/** Final call to action on ink, with the template notch and the pointing unicorn. */
export const LandingFinalCta = async () => {
  const t = await getT(landingBottom);
  return (
    <section aria-label={t("ctaAria")} className={c.CTA_WRAP}>
      <div className={c.CTA_CARD}>
        <div className={c.NOTCH} aria-hidden="true" />
        <div className={c.CTA_TEXT_COL}>
          <div className={c.CTA_MARK}>
            <NivoLogo variant="mark" height={34} />
          </div>
          <h2 className={c.CTA_H2}>{t("ctaTitle")}</h2>
          <p className={c.CTA_P}>{t("ctaText")}</p>
          <div className={c.CTA_BTN}>
            <Button variant="primary" size="lg" width="fill" href={LANDING_OFFER.ctaHref}>
              {t("ctaButton")}
            </Button>
          </div>
          <p className={c.CTA_NOTE}>{t("ctaNote")}</p>
        </div>
        <img className={c.CTA_MASCOT_MOBILE} src="/images/promo/mascot-point.png" alt={t("ctaMascotAlt")} />
        <img className={c.CTA_MASCOT_DESKTOP} src="/images/promo/mascot-point.png" alt={t("ctaMascotAlt")} />
      </div>
    </section>
  );
};
