"use client";

import { RouteError } from "@/components/state/RouteError";
import { useT } from "@/i18n/client";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { shell } from "@/i18n/dict/shell";

/** STATE-8 case-4: an agent route whose data fails keeps its trail and the Modules heading, with one Alert and a retry. */
const AgentRouteError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(modulesCore);
  const ts = useT(shell);
  return <RouteError crumbs={[{ id: "home", label: ts("crumbHome"), href: "/dashboard" }, { id: "modules", label: t("catalogTitle"), href: "/m" }]} title={t("catalogTitle")} onRetry={reset} />;
};

export default AgentRouteError;
