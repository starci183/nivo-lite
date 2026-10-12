"use client"

import { RouteError } from "@/components/blocks/RouteError"
import { useT } from "@/i18n/client"
import { overview } from "@/i18n/dict/overview"
import { shell } from "@/i18n/dict/shell"

/** STATE-8 case-4: the Overview keeps its heading when its data fails, with one Alert and a retry (it is the home page, so its trail is just itself). */
const DashboardError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(overview)
  const s = useT(shell)
  return <RouteError crumbs={[{ id: "home", label: s("crumbHome") }]} title={s("crumbHome")} message={t("loadFailed")} onRetry={reset} />
}

export default DashboardError
