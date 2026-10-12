"use client";

import { Alert, Breadcrumbs, PageContainer, SectionHeader } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { credits as dict } from "@/i18n/dict/credits";
import { HEAD_CLASS_NAME, PAGE_CLASS_NAME } from "@/features/credits/classNames";

/** Route error: the breadcrumbs and heading stay, one negative alert says what failed and offers the retry (STATE-8). */
const BillingError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(dict);
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS_NAME}>
        <div className={HEAD_CLASS_NAME}>
          <Breadcrumbs label={t("crumbLabel")} items={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "credits", label: t("title") }]} />
          <SectionHeader level={1} title={t("title")} description={t("description")} />
        </div>
        <Alert tone="negative" title={t("errorTitle")} description={t("errorText")} action={{ label: t("retry"), onAction: reset }} />
      </div>
    </PageContainer>
  );
};

export default BillingError;
