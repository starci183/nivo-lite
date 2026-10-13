"use client";

import { RouteError } from "@/components/blocks/RouteError"
import { useT } from "@/i18n/client";
import { leads } from "@/i18n/dict/leads";

/** STATE-8 case-4: the Leads page keeps its trail and heading when its data fails, with one Alert and a retry. */
const LeadsError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(leads);
  return <RouteError crumbs={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "leads", label: t("title") }]} title={t("title")} message={t("loadFailedLeads")} onRetry={reset} />;
};

export default LeadsError;
