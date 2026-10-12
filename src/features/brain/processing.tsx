"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Alert, Progress } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"
import { useInFlight, type InFlight } from "@/lib/knowledge/live"
import { STACK_CLASS } from "./classNames"

type ProcessingNoticeProps = {
  readonly workspaceId: string
  /** The documents the server render saw still being worked on. */
  readonly seed: ReadonlyArray<InFlight>
}

/**
 * "Đang xử lý N tài liệu": while any document of the workspace is queued, being read, indexed or having its facts extracted, a notice with a
 * progress bar, fed by realtime on knowledge_sources. When the last one finishes the page refreshes, so facts and counts catch up.
 */
export const ProcessingNotice = ({ workspaceId, seed }: ProcessingNoticeProps) => {
  const t = useT(brain)
  const router = useRouter()
  const { active, percent, settled } = useInFlight(workspaceId, seed)
  useEffect(() => { if (settled > 0) router.refresh() }, [settled, router])
  if (active === 0) return null
  return (
    <div className={STACK_CLASS}>
      <Alert tone="informative" appearance="soft" title={t("processingTitle", { count: active })} description={t("processingBody")} />
      <Progress label={t("processingLabel")} value={percent} />
    </div>
  )
}
