import { Badge, Button, PageContainer, Region, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common";
import type { IconName } from "@/ui";
import { getLocale } from "@/i18n/server";
import { translator } from "@/i18n/core";
import { landingBottom } from "@/i18n/dict/landingBottom";
import { isOfferLive } from "@/lib/promo";
import { LandingIconTile } from "../LandingIconTile";
import { ANCHOR } from "../classNames";
import { FOUNDING_OFFER, foundingPriceVnd, LANDING_OFFER } from "../offer";
import { OfferCountdown } from "./countdown";
import { formatDate, formatVnd } from "./format";
import * as c from "./classNames";

type FactProps = { readonly icon: IconName; readonly title: string; readonly text: string };

/** One scope fact on its own top-level card; the old hand-drawn SVG glyphs are registry Heroicons on a neutral tile. */
const Fact = ({ icon, title, text }: FactProps) => (
  <SurfaceCard height="fill">
    <div className={c.FACT_BODY}>
      <LandingIconTile name={icon} />
      <Text size="md" weight="semibold">
        {title}
      </Text>
      <Text size="sm" tone="muted">
        {text}
      </Text>
    </div>
  </SurfaceCard>
);

/**
 * id="founding": the "clear scope" facts plus the NIVO Start price card merged with the Founding 50 campaign.
 * The price card is the section's one featured card (`isHighlight`); its price is the region's lead figure
 * (FONT-5, DISCIPLINE-2) with the unit set lighter beside it, and the crossed-out base price is `Text isSuperseded`.
 * The tile mascot was removed (DISCIPLINE-3: one signature moment per page, carried by the final call to action).
 */
export const LandingOffer = async () => {
  const locale = await getLocale();
  const t = translator(landingBottom, locale);
  const live = isOfferLive();
  const date = formatDate(FOUNDING_OFFER.endsAt, locale);
  const card = LANDING_OFFER.cardRequired ? t("fact2Card") : t("fact2NoCard");

  return (
    <Region id="founding" label={t("offerAria")} className={ANCHOR}>
      <PageContainer measure="product">
        <div className={c.SECTION_STACK}>
          <SectionHeader eyebrow={t("offerEyebrow")} title={t("offerTitle")} />
          <div className={c.BENTO}>
            <div className={c.FACTS_COL}>
              <Fact icon="review" title={t("fact1Title")} text={t("fact1Text")} />
              <Fact icon="pending" title={t("fact2Title", { days: LANDING_OFFER.trialDays })} text={t("fact2Text", { card })} />
            </div>

            <SurfaceCard
              label={t("priceLabel")}
              headingLevel={3}
              labelEnd={live ? <Badge tone="accent">{t("foundingTag")}</Badge> : undefined}
              isHighlight
              height="fill"
            >
              <div className={c.TILE_BODY}>
                <div className={c.PRICE_STACK}>
                  <Text size="sm" tone="muted" weight="medium">
                    {LANDING_OFFER.planName}
                  </Text>
                  {live ? (
                    <Text tone="muted" isSuperseded>
                      {formatVnd(LANDING_OFFER.startPriceVnd, locale)}
                    </Text>
                  ) : null}
                  <div className={c.PRICE_ROW}>
                    <Text size="metric-lead" weight="semibold">
                      {formatVnd(live ? foundingPriceVnd() : LANDING_OFFER.startPriceVnd, locale)}
                    </Text>
                    <Text size="sm" tone="muted">
                      {t("perMonth")}
                    </Text>
                  </div>
                  <Text size="sm" tone="muted">
                    {live ? t("foundingPriceLabel") : t("priceAfterTrial")}
                  </Text>
                  {live ? (
                    <Text tone="accent" weight="semibold">
                      {t("foundingSaving", { percent: FOUNDING_OFFER.percentOff, cap: FOUNDING_OFFER.cap })}
                    </Text>
                  ) : null}
                </div>
                <div className={c.TILE_FOOT}>
                  {live ? (
                    <>
                      <OfferCountdown date={date} />
                      <Text size="xs">{t("offerEnds", { date })}</Text>
                    </>
                  ) : null}
                  <Button variant="primary" size="lg" width="fill" href={LANDING_OFFER.ctaHref}>
                    {t("offerCta")}
                  </Button>
                  <Text size="xs">{t("offerFine")}</Text>
                </div>
              </div>
            </SurfaceCard>

            <div className={c.FACTS_COL}>
              <Fact icon="support" title={t("fact3Title")} text={t("fact3Text")} />
              <Fact icon="account" title={t("fact4Title")} text={t("fact4Text")} />
            </div>
          </div>
        </div>
      </PageContainer>
    </Region>
  );
};
