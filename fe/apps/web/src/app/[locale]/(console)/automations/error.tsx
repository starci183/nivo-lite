"use client"

import { RouteError } from "@/components/state/RouteError"
import { useT } from "@/i18n/client"
import { automations } from "@/i18n/dict/automations"

/** STATE-8 case-4: Automations keeps its trail and heading when its data fails, with one Alert and a retry. */
const AutomationsError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(automations)
  return <RouteError crumbs={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "automations", label: t("title") }]} title={t("title")} message={t("loadFailed")} onRetry={reset} />
}

export default AutomationsError
