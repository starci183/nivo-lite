"use client"

import { RouteError } from "@/components/state/RouteError"
import { useT } from "@/i18n/client"
import { decisions } from "@/i18n/dict/decisions"

/** STATE-8 case-4: the decision history keeps its trail and heading when its data fails, with one Alert and a retry. */
const DecisionsError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(decisions)
  return <RouteError crumbs={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "decisions", label: t("title") }]} title={t("title")} message={t("loadFailedBody")} onRetry={reset} />
}

export default DecisionsError
