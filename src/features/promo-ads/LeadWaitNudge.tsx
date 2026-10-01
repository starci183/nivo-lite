"use client"

import { useEffect, useState } from "react"
import { Button, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { promoAds } from "@/i18n/dict/promoAds"
import { readLeadWait } from "./actions"
import { NUDGE } from "./classNames"
import type { LeadWait } from "./queries"

type LeadWaitNudgeProps = { readonly leadId: string }

/** Small note under the lead header: website lead, no chatbot. Wait hours only when computed from real events. */
export const LeadWaitNudge = ({ leadId }: LeadWaitNudgeProps) => {
  const t = useT(promoAds)
  const [wait, setWait] = useState<LeadWait | null>(null)
  useEffect(() => {
    let cancelled = false
    void readLeadWait(leadId).then((next) => {
      if (!cancelled) setWait(next)
    })
    return () => {
      cancelled = true
    }
  }, [leadId])
  if (wait === null || !wait.show) return null
  const detail = wait.hours === null
    ? null
    : wait.replied
      ? t("nudgeReplied", { h: wait.hours })
      : t("nudgeWaiting", { h: wait.hours })
  return (
    <div className={NUDGE} role="note">
      <Text size="sm" tone="muted">
        {detail === null ? t("nudgeBody") : `${t("nudgeBody")} ${detail}`}
      </Text>
      <Button variant="ghost" size="sm" href="/modules/new?module=chatbot">{t("seeChatbot")}</Button>
    </div>
  )
}
