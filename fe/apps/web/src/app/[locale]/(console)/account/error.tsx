"use client"

import { RouteError } from "@/components/blocks/RouteError"
import { useT } from "@/i18n/client"
import { account } from "@/i18n/dict/account"

/** STATE-8 case-4: the account page keeps its trail and heading when its data fails, with one Alert and a retry. */
const AccountError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(account)
  return <RouteError crumbs={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "account", label: t("title") }]} title={t("title")} message={t("loadFailed")} onRetry={reset} />
}

export default AccountError
