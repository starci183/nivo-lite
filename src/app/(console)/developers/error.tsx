"use client"

import { RouteError } from "@/components/state/RouteError"
import { useT } from "@/i18n/client"
import { developers } from "@/i18n/dict/developers"

/** STATE-8 case-4: the Advanced page keeps its trail and heading when its data fails, with one Alert and a retry. */
const DevelopersError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(developers)
  return <RouteError crumbs={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "developers", label: t("title") }]} title={t("title")} message={t("loadFailed")} onRetry={reset} />
}

export default DevelopersError
