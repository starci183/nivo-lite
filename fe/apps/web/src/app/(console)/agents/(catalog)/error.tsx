"use client";

import { RouteError } from "@/components/state/RouteError";
import { useT } from "@/i18n/client";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { shell } from "@/i18n/dict/shell";

/** STATE-8 case-4: the module catalogue keeps its trail and heading when the installations fail, with one Alert and a retry. */
const ModulesCatalogError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(modulesCore);
  const ts = useT(shell);
  return <RouteError crumbs={[{ id: "home", label: ts("crumbHome"), href: "/dashboard" }, { id: "modules", label: t("catalogTitle") }]} title={t("catalogTitle")} onRetry={reset} />;
};

export default ModulesCatalogError;
