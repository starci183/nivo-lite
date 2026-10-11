import { Button, Heading, PageContainer, Region, Text } from "@starci/grammar/common";
import { getLocale, getT } from "@/i18n/server";
import { landing } from "@/i18n/dict/landing";
import { BrowserFrame } from "./BrowserFrame";
import { LANDING_OFFER } from "./offer";
import { HERO_ACTIONS, HERO_COPY, HERO_NOTES, LEAD_MEASURE, SECTION_STACK } from "./classNames";

/**
 * Hero, the page's focal point (HIERARCHY-6): promise, calls to action and one large real screenshot of the
 * Overview. The one display heading of the page (FONT-6); the second title line no longer takes accent paint,
 * because headings spend no accent (ACCENT-6 case-2).
 */
export const LandingHero = async () => {
  const [t, locale] = await Promise.all([getT(landing), getLocale()]);
  return (
    <Region label={`${t("heroLine1")} ${t("heroLine2")}`}>
      <PageContainer measure="product">
        <div className={SECTION_STACK}>
          <div className={HERO_COPY}>
            <Text size="sm" tone="muted" weight="medium">
              {t("heroEyebrow")}
            </Text>
            <Heading level={1} scale="display">
              {t("heroLine1")}
              <br />
              {t("heroLine2")}
            </Heading>
            <div className={LEAD_MEASURE}>
              <Text tone="muted">{t("heroLead")}</Text>
            </div>
            <div className={HERO_ACTIONS}>
              <Button variant="primary" size="lg" width="fill" href={LANDING_OFFER.ctaHref}>
                {t("heroCta")}
              </Button>
              <Button variant="secondary" size="lg" width="fill" href="#product">
                {t("heroSecondary")}
              </Button>
            </div>
            <div className={HERO_NOTES}>
              <Text size="xs">{t("heroNote", { days: LANDING_OFFER.trialDays })}</Text>
              <Text size="xs">{t("tagline")}</Text>
            </div>
          </div>
          <BrowserFrame
            src={`/images/landing/${locale}/overview.png`}
            alt={t("shotOverview")}
            label={t("demoLabel")}
            width={1440}
            height={830}
            priority
          />
        </div>
      </PageContainer>
    </Region>
  );
};
