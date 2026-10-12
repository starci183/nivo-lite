import {
  Avatar,
  Badge,
  Button,
  Heading,
  Image,
  IncludedMark,
  List,
  ListRow,
  PageContainer,
  Region,
  SurfaceCard,
  Text,
} from "@starci/grammar/common";
import { getLocale, getT } from "@/i18n/server";
import { landing } from "@/i18n/dict/landing";
import { BrowserFrame } from "./BrowserFrame";
import { FOUNDING_OFFER, LANDING_OFFER } from "./offer";
import {
  HERO_ACTIONS,
  HERO_ART_BAND,
  HERO_COPY,
  HERO_FACT,
  HERO_FACTS,
  HERO_GRID,
  LEAD_MEASURE,
  SECTION_STACK,
} from "./classNames";

/**
 * Hero, the page's focal point (HIERARCHY-6): promise and calls to action on the left, one real "what NIVO follows
 * today" card on the right, then one large real screenshot of the Overview. The one display heading of the page
 * (FONT-6); headings spend no accent (ACCENT-6 case-2). The card's art band is the decorative accent slab of
 * SURFACE-6; the page's one brand signature moment (DISCIPLINE-3) is spent there.
 */
export const LandingHero = async () => {
  const [t, locale] = await Promise.all([getT(landing), getLocale()]);
  const facts = [t("heroFactNoCard"), t("heroFactSetup"), t("heroFactChannels")];
  return (
    <Region label={`${t("heroLine1")} ${t("heroLine2")}`}>
      <PageContainer measure="product">
        <div className={SECTION_STACK}>
          <div className={HERO_GRID}>
            <div className={HERO_COPY}>
              <Badge tone="accent">{t("heroOffer", { percent: FOUNDING_OFFER.percentOff })}</Badge>
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
              <div className={HERO_FACTS}>
                {facts.map((fact) => (
                  <span key={fact} className={HERO_FACT}>
                    <IncludedMark />
                    <Text size="sm">{fact}</Text>
                  </span>
                ))}
              </div>
              <Text size="xs" tone="muted">
                {t("tagline")}
              </Text>
            </div>
            <SurfaceCard label={t("heroCardTitle")} headingLevel={2} composition="joined">
              <div className={HERO_ART_BAND} aria-hidden="true">
                <Image src="/images/entry/hero-mascot.png" alt="" aspect="wide" fit="contain" plate="none" />
              </div>
              <List label={t("heroCardAria")}>
                <ListRow
                  leading={<Avatar name="Minh" size="md" isDecorative />}
                  title={t("heroRow1Title")}
                  description={t("heroRow1Desc")}
                  badges={<Badge tone="warning">{t("heroRow1Badge")}</Badge>}
                />
                <ListRow
                  leading={<Avatar name="Lan" size="md" isDecorative />}
                  title={t("heroRow2Title")}
                  description={t("heroRow2Desc")}
                  badges={<Badge tone="success">{t("heroRow2Badge")}</Badge>}
                />
              </List>
            </SurfaceCard>
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
