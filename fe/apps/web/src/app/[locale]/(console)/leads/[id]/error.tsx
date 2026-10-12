"use client";

import { RouteError } from "@/components/blocks/RouteError"
import { useT } from "@/i18n/client";
import { leads } from "@/i18n/dict/leads";

/** STATE-8 case-4: the lead page keeps its trail and heading when its data fails, with one Alert and a retry. */
const LeadError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(leads);
  return (
    <RouteError
      crumbs={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "leads", label: t("title"), href: "/leads" }, { id: "lead", label: t("detailEyebrow") }]}
      title={t("detailEyebrow")}
      message={t("loadFailedLead")}
      onRetry={reset}
    />
  );
};

export default LeadError;
