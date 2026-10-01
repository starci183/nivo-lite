"use client";

import { useT } from "@/i18n/client"
import { leads } from "@/i18n/dict/leads"
import { PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"

/** Leads skeleton: same layout, cards in loading state. */
const LeadsLoading = () => {
  const t = useT(leads)
  return (
    <PageContainer measure="product">
      <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("descriptionShort")} />
      <SurfaceCard ariaLabel={t("loadingLeads")}>
        <Text isSkeleton>{t("loadingLeads")}</Text>
      </SurfaceCard>
    </PageContainer>
  )
}

export default LeadsLoading
