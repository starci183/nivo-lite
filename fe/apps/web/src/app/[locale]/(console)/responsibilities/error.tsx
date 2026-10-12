"use client";

import { RouteError } from "@/components/blocks/RouteError"
import { useT } from "@/i18n/client";
import { responsibilities } from "@/i18n/dict/responsibilities";

/** STATE-8 case-4: the responsibility board keeps its trail and heading when its data fails, with one Alert and a retry. */
const ResponsibilitiesError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(responsibilities);
  return <RouteError crumbs={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "responsibilities", label: t("pageTitle") }]} title={t("pageTitle")} message={t("loadFailed")} onRetry={reset} />;
};

export default ResponsibilitiesError;
