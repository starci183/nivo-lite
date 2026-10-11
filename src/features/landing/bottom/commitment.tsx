import { Fragment } from "react";
import { Avatar, Badge, Divider, PageContainer, Region, SectionHeader, SurfaceCard, SurfaceCopyGroup, Text } from "@starci/grammar/common";
import { getT } from "@/i18n/server";
import { landingBottom } from "@/i18n/dict/landingBottom";
import { ANCHOR } from "../classNames";
import * as c from "./classNames";

/**
 * Principles block, one joined card in three bands (DISCIPLINE-1 case-2: two separators): who speaks, the quote,
 * the two principles. Attribution is the NIVO team, never a personal quote or a photo of a person; its mark is a
 * Grammar `Avatar` of the NIVO entity. The decorative arcs of the old side panel were removed (DISCIPLINE-1).
 */
export const LandingCommitment = async () => {
  const t = await getT(landingBottom);
  const titleLines = t("commitTitle").split("\n");
  return (
    <Region id="commitment" label={t("commitAria")} className={ANCHOR}>
      <PageContainer measure="product">
        <div className={c.SECTION_STACK}>
          <SectionHeader
            eyebrow={t("commitEyebrow")}
            title={titleLines.map((line, i) => (
              <Fragment key={line}>
                {i > 0 ? <br /> : null}
                {line}
              </Fragment>
            ))}
          />
          <SurfaceCard composition="joined">
            <div className={c.BAND_FIRST}>
              <SurfaceCopyGroup>
                <Text size="xs">{t("commitPanelLabel")}</Text>
                <Text weight="medium">{t("commitPanelText")}</Text>
              </SurfaceCopyGroup>
              <div className={c.AUTHOR}>
                <Avatar name={t("commitAuthor")} src="/brand/nivo-mark.png" size="md" isDecorative />
                <div className={c.AUTHOR_TEXT}>
                  <Text weight="medium">{t("commitAuthor")}</Text>
                  <Text size="sm" tone="muted">
                    {t("commitAuthorRole")}
                  </Text>
                </div>
              </div>
            </div>
            <Divider semantics="presentation" />
            <div className={c.BAND_MID}>
              <blockquote className={c.QUOTE}>
                <Text size="md" weight="medium">{`“${t("commitQuote")}”`}</Text>
              </blockquote>
              <div className={c.AI_NOTE}>
                <Badge tone="neutral">{t("commitAiChip")}</Badge>
                <Text size="sm" tone="muted">
                  {t("commitAiNote")}
                </Text>
              </div>
            </div>
            <Divider semantics="presentation" />
            <div className={c.BAND_LAST}>
              <div className={c.PRINCIPLES}>
                <SurfaceCopyGroup>
                  <Text weight="medium">{t("principle1Title")}</Text>
                  <Text size="sm" tone="muted">
                    {t("principle1Text")}
                  </Text>
                </SurfaceCopyGroup>
                <SurfaceCopyGroup>
                  <Text weight="medium">{t("principle2Title")}</Text>
                  <Text size="sm" tone="muted">
                    {t("principle2Text")}
                  </Text>
                </SurfaceCopyGroup>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </PageContainer>
    </Region>
  );
};
