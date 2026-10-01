"use client";

import { useT } from "@/i18n/client";
import { leads } from "@/i18n/dict/leads";
import { Button, EmptyNotice, PageContainer, SurfaceCard } from "@starci/grammar/common";

/** Shown when the lead id does not exist. */
const NotFound = () => {
  const t = useT(leads);
  return (
    <PageContainer measure="reading">
      <SurfaceCard ariaLabel={t("notFoundAria")}>
        <EmptyNotice message={t("notFoundTitle")} description={t("notFoundBody")} />
        <Button variant="secondary" href="/leads">{t("notFoundBack")}</Button>
      </SurfaceCard>
    </PageContainer>
  );
};

export default NotFound;
