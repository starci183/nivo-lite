"use client"

import { RouteError } from "@/components/blocks/RouteError"
import { useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"

/** STATE-8 case-4: the Second Brain keeps its trail and heading when its data fails, with one Alert and a retry. */
const BrainError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(brain)
  return <RouteError crumbs={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "brain", label: t("title") }]} title={t("title")} message={t("loadFailed")} onRetry={reset} />
}

export default BrainError
