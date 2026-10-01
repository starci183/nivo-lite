"use client";

import { useT } from "@/i18n/client";
import { shell } from "@/i18n/dict/shell";
import { Heading, PageContainer, Skeleton, SurfaceCard, Text } from "@starci/grammar/common";

/** Skeleton of the page area while a console route loads. */
const ConsoleLoading = () => {
  const t = useT(shell);
  return (
  <PageContainer measure="product">
    <Heading level={1} isSkeleton>
      {t("loading")}
    </Heading>
    <SurfaceCard ariaLabel={t("loading")}>
      <Text isSkeleton>{t("loading")}</Text>
      <Skeleton shape="text" lines={4} />
    </SurfaceCard>
  </PageContainer>
  );
};

export default ConsoleLoading;
