"use client";

import { RouteError } from "@/components/state/RouteError";
import { moduleDef, pick } from "@/lib/module-registry";
import { isModuleKey } from "@/lib/modules-shared";
import { useParams } from "next/navigation";
import { useLocale, useT } from "@/i18n/client";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { shell } from "@/i18n/dict/shell";

/** STATE-8 case-4: the Setup tab keeps the module's trail and the tab's heading when its data fails, with one Alert and a retry. */
const SetupError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(modulesCore);
  const ts = useT(shell);
  const locale = useLocale();
  const { module } = useParams<{ module?: string }>();
  const name = isModuleKey(module) ? pick(moduleDef(module).name, locale) : t("catalogTitle");
  return (
    <RouteError
      crumbs={[{ id: "home", label: ts("crumbHome"), href: "/dashboard" }, { id: "modules", label: t("catalogTitle"), href: "/agents" }, { id: "module", label: name }]}
      title={t("tabSetup")}
      onRetry={reset}
    />
  );
};

export default SetupError;
