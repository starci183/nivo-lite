"use client"

import { RouteError } from "@/components/blocks/RouteError"
import { knowledgeTrail } from "@/features/knowledge/trail"
import { useT } from "@/i18n/client"
import { knowledge } from "@/i18n/dict/knowledge"

/** STATE-8 case-4: Documents keep their trail and heading when the data fails, with one Alert and a retry. */
const KnowledgeError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(knowledge)
  return <RouteError crumbs={knowledgeTrail({ brain: t("crumbBrain"), docs: t("title") })} title={t("title")} message={t("loadFailBody")} onRetry={reset} />
}

export default KnowledgeError
