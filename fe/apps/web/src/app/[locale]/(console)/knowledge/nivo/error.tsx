"use client"

import { RouteError } from "@/components/blocks/RouteError"
import { knowledgeTrail } from "@/features/knowledge/trail"
import { useT } from "@/i18n/client"
import { knowledge } from "@/i18n/dict/knowledge"

/** STATE-8 case-4: the NIVO knowledge page keeps its trail and heading when the data fails. */
const NivoError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(knowledge)
  return <RouteError crumbs={knowledgeTrail({ brain: t("crumbBrain"), docs: t("title") }, t("nivoTitle"))} title={t("nivoTitle")} message={t("loadFailBody")} onRetry={reset} />
}

export default NivoError
