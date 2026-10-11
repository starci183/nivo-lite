"use client"

import { RouteError } from "@/components/state/RouteError"
import { knowledgeTrail } from "@/features/knowledge/trail"
import { useT } from "@/i18n/client"
import { knowledge } from "@/i18n/dict/knowledge"

/** STATE-8 case-4: a source page whose data fails keeps its trail and the Documents heading, with one Alert and a retry. */
const SourceError = ({ reset }: { readonly reset: () => void }) => {
  const t = useT(knowledge)
  return <RouteError crumbs={knowledgeTrail({ brain: t("crumbBrain"), docs: t("title") })} title={t("title")} message={t("loadFailBody")} onRetry={reset} />
}

export default SourceError
