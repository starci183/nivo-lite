import { Button, Heading, PageContainer, Region, SurfaceCard, Text } from "@starci/grammar/common";
import { getT } from "@/i18n/server";
import { landingBottom } from "@/i18n/dict/landingBottom";
import { LANDING_OFFER } from "../offer";
import * as c from "./classNames";

/**
 * Final call to action on Grammar's ink band (`SurfaceCard treatment="ink"`). No artwork: the hero's mascot band is
 * the page's one signature moment (DISCIPLINE-3 case-3), so the pointing unicorn left this band.
 *
 * grammar gap: the ink band paints `--accent`, and the NIVO accent is the same crimson a `primary` Button fills
 * with, so a primary action would be crimson on crimson. The band's one action therefore takes `secondary`
 * (the band re-binds its plate and foreground) until Grammar ships an on-ink primary action treatment.
 */
export const LandingFinalCta = async () => {
  const t = await getT(landingBottom);
  return (
    <Region label={t("ctaAria")}>
      <PageContainer measure="product">
        <SurfaceCard treatment="ink">
          <div className={c.CTA_COPY}>
            <Heading level={2}>{t("ctaTitle")}</Heading>
            <Text>{t("ctaText")}</Text>
            <Button variant="secondary" size="lg" href={LANDING_OFFER.ctaHref}>
              {t("ctaButton")}
            </Button>
            <Text size="xs">{t("ctaNote")}</Text>
          </div>
        </SurfaceCard>
      </PageContainer>
    </Region>
  );
};
