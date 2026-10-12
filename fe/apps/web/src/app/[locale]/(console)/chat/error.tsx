"use client"

import { RouteError } from "@/components/state/RouteError"
import { useT } from "@/i18n/client"
import { office } from "@/i18n/dict/office"

/** STATE-8 case-4: the Office keeps its trail and heading when its data fails, with one Alert and a retry. */
const ChatError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(office)
  return <RouteError crumbs={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "chat", label: t("title") }]} title={t("title")} message={t("loadFailed")} onRetry={reset} />
}

export default ChatError
