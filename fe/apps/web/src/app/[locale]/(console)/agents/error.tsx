"use client";

import { RouteError } from "@/components/blocks/RouteError"
import { useT } from "@/i18n/client";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { shell } from "@/i18n/dict/shell";

/** STATE-8 case-4: when a module's frame fails (its installation could not load) the trail and the Modules heading stay, with one Alert and a retry. */
const ModuleFrameError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(modulesCore);
  const ts = useT(shell);
  return <RouteError crumbs={[{ id: "home", label: ts("crumbHome"), href: "/dashboard" }, { id: "modules", label: t("catalogTitle"), href: "/agents" }]} title={t("catalogTitle")} onRetry={reset} />;
};

export default ModuleFrameError;
