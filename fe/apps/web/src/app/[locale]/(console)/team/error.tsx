"use client"

import { RouteError } from "@/components/blocks/RouteError"
import { useT } from "@/i18n/client"
import { team } from "@/i18n/dict/team"

/** STATE-8 case-4: the Team page keeps its trail and heading when its data fails, with one Alert and a retry. */
const TeamError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(team)
  return <RouteError crumbs={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "team", label: t("title") }]} title={t("title")} message={t("loadFailBody")} onRetry={reset} />
}

export default TeamError
