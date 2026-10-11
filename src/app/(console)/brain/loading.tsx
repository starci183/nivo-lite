"use client"

import { Heading, PageContainer, PrimaryRailLayout, Skeleton, SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common"
import { HEAD_CLASS, PAGE_CLASS, SIDE_CLASS, STACK_CLASS, STAT_SKELETON_CLASS } from "@/features/brain/classNames"
import { useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"

/**
 * Second Brain while it loads: the same anatomy as the page (trail and heading, the figures card, the tabs over the map card,
 * the rail's list cards) so nothing jumps when the data lands.
 */
const BrainLoading = () => {
  const t = useT(brain)
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS} aria-busy="true">
        <div className={HEAD_CLASS}>
          <Text size="sm" isSkeleton>{t("crumbHome")}</Text>
          <Heading level={1} isSkeleton>{t("title")}</Heading>
          <Text tone="muted" isSkeleton>{t("intro")}</Text>
        </div>
        <SurfaceCard ariaLabel={t("statsLabel")}>
          <div className={STAT_SKELETON_CLASS}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} shape="text" lines={3} />)}
          </div>
        </SurfaceCard>
        <PrimaryRailLayout
          railWidth="standard"
          primary={
            <div className={STACK_CLASS}>
              <Skeleton shape="text" lines={1} />
              <SurfaceCard ariaLabel={t("mapAria")}>
                <Skeleton shape="rect" ratio="landscape" />
              </SurfaceCard>
            </div>
          }
          rail={
            <div className={SIDE_CLASS}>
              <SurfaceListCard label={t("lensTitle")} headingLevel={2} isLoading />
              <SurfaceListCard label={t("startTitle")} headingLevel={2} isLoading />
            </div>
          }
        />
      </div>
    </PageContainer>
  )
}

export default BrainLoading
