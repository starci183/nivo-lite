"use client";

import { useT } from "@/i18n/client";
import { shell } from "@/i18n/dict/shell";
import { Button, Heading, PageContainer, SurfaceCard, Text } from "@starci/grammar/common";

/** Unknown route. */
const NotFound = () => {
  const t = useT(shell);
  return (
  <PageContainer measure="reading">
    <SurfaceCard ariaLabel={t("notFoundTitle")}>
      <Heading level={1}>{t("notFoundTitle")}</Heading>
      <Text tone="muted">{t("notFoundText")}</Text>
      <Button variant="secondary" href="/dashboard">
        {t("backToOverview")}
      </Button>
    </SurfaceCard>
  </PageContainer>
  );
};

export default NotFound;
