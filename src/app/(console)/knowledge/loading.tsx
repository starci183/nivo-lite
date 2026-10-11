"use client"

import { Heading, PageContainer, PrimaryRailLayout, Skeleton, SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common"
import { HEAD_CLASS, PAGE_CLASS, SIDE_CLASS, STACK_CLASS } from "@/features/knowledge/classNames"
import { useT } from "@/i18n/client"
import { knowledge } from "@/i18n/dict/knowledge"

/** Documents while they load: the page's own anatomy (trail and heading, filter over the sources list, the rail's cards). */
const KnowledgeLoading = () => {
  const t = useT(knowledge)
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS} aria-busy="true">
        <div className={HEAD_CLASS}>
          <Text size="sm" isSkeleton>{t("crumbBrain")}</Text>
          <Heading level={1} isSkeleton>{t("title")}</Heading>
          <Text tone="muted" isSkeleton>{t("description")}</Text>
        </div>
        <PrimaryRailLayout
          railWidth="standard"
          primary={
            <div className={STACK_CLASS}>
              <Skeleton shape="text" lines={1} />
              <SurfaceListCard label={t("listTitle")} headingLevel={2} isLoading />
            </div>
          }
          rail={
            <div className={SIDE_CLASS}>
              <SurfaceCard label={t("askTitle")} headingLevel={2}>
                <Skeleton shape="text" lines={3} />
              </SurfaceCard>
              <SurfaceListCard label={t("suggestTitle")} headingLevel={2} isLoading />
            </div>
          }
        />
      </div>
    </PageContainer>
  )
}

export default KnowledgeLoading
