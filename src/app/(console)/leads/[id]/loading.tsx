"use client";

import { useT } from "@/i18n/client";
import { leads } from "@/i18n/dict/leads";
import { PageContainer, SectionHeader, Skeleton, SurfaceCard } from "@starci/grammar/common";

/** Lead page loading state: same header, skeleton content. */
const Loading = () => {
  const t = useT(leads);
  return (
    <PageContainer measure="product">
      <SectionHeader level={1} eyebrow={t("detailEyebrow")} title={t("detailLoading")} />
      <SurfaceCard ariaLabel={t("detailLoading")}>
        <Skeleton shape="text" lines={6} />
      </SurfaceCard>
    </PageContainer>
  );
};

export default Loading;
