"use client"

import { RouteError } from "@/components/blocks/RouteError"
import { useT } from "@/i18n/client"
import { connections as dict } from "@/i18n/dict/connections"

/** STATE-8 case-4: Connections keep their trail and heading when the data fails, with one Alert and a retry. */
const ConnectionsError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(dict)
  return <RouteError crumbs={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "connections", label: t("title") }]} title={t("title")} onRetry={reset} />
}

export default ConnectionsError
