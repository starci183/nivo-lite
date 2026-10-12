"use client"

import { RouteError } from "@/components/blocks/RouteError"
import { useT } from "@/i18n/client"
import { inbox } from "@/i18n/dict/inbox"

/** STATE-8 case-4: the Inbox keeps its trail and heading when its data fails, with one Alert and a retry. */
const InboxError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(inbox)
  return <RouteError crumbs={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "inbox", label: t("title") }]} title={t("title")} message={t("loadFailBody")} onRetry={reset} />
}

export default InboxError
