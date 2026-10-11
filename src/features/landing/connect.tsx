import { Badge, Button, PageContainer, Region, SectionHeader, SurfaceCopyGroup, SurfaceListCard, Text } from "@starci/grammar/common";
import { getT } from "@/i18n/server";
import { landing } from "@/i18n/dict/landing";
import { LANDING_OFFER } from "./offer";
import { CHANNEL_ROW, CONNECT_COPY, CONNECT_GRID, SECTION_STACK } from "./classNames";

const CHANNELS = [
  { name: "chWebsite", text: "chWebsiteText", live: true },
  { name: "chZalo", text: "chZaloText", live: false },
  { name: "chEmail", text: "chEmailText", live: false },
  { name: "chForm", text: "chFormText", live: false },
] as const;

const HEADING_ID = "landing-connect";

/**
 * Connect section: the channel that works today and the ones on the roadmap. It sits on the page canvas: the ink
 * band is spent once per page, on the final call to action (DISCIPLINE-3). The channel state is stated in words on a
 * Badge; only the live channel takes a status tone (ACCENT-5).
 */
export const LandingConnect = async () => {
  const t = await getT(landing);
  return (
    <Region labelledBy={HEADING_ID}>
      <PageContainer measure="product">
        <div className={CONNECT_GRID}>
          <div className={CONNECT_COPY}>
            <SectionHeader id={HEADING_ID} eyebrow={t("connectEyebrow")} title={t("connectTitle")} description={t("connectLead")} />
            <Button variant="primary" size="lg" href={LANDING_OFFER.ctaHref}>
              {t("connectCta")}
            </Button>
          </div>
          <div className={SECTION_STACK}>
            <SurfaceListCard ariaLabel={t("connectTitle")}>
              {CHANNELS.map((c) => (
                <li key={c.name} className={CHANNEL_ROW}>
                  <SurfaceCopyGroup>
                    <Text weight="medium">{t(c.name)}</Text>
                    <Text size="sm" tone="muted">
                      {t(c.text)}
                    </Text>
                  </SurfaceCopyGroup>
                  {c.live ? (
                    <Badge tone="success" isDot>
                      {t("connectAvailable")}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">{t("connectRoadmap")}</Badge>
                  )}
                </li>
              ))}
            </SurfaceListCard>
            <Text size="sm" tone="muted">
              {t("connectNote")}
            </Text>
          </div>
        </div>
      </PageContainer>
    </Region>
  );
};
