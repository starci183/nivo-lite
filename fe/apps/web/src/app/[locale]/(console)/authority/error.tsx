"use client"

import { RouteError } from "@/components/state/RouteError"
import { useT } from "@/i18n/client"
import { authority } from "@/i18n/dict/authority"

/** STATE-8 case-4: Authority keeps its trail and heading when its data fails, with one Alert and a retry. */
const AuthorityError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(authority)
  return <RouteError crumbs={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "authority", label: t("title") }]} title={t("title")} message={t("loadFailBody")} onRetry={reset} />
}

export default AuthorityError
