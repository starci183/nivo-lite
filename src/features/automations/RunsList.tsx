"use client"

import Link from "next/link"
import { Badge, Text } from "@starci/grammar/common"
import { intlLocale, TIME_ZONE } from "@/i18n/core"
import { useLocale, useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import type { AutomationRunView } from "@/lib/automation-shared"
import { DISCLOSURE_BODY_CLASS, DISCLOSURE_CLASS, LINK_CLASS, RUN_HEAD_CLASS, RUN_ROW_CLASS, SECTION_CLASS } from "./classNames"

/** Props for {@link RunsList}. */
export type RunsListProps = { readonly runs: ReadonlyArray<AutomationRunView> }

const TONE = { done: "success", queued: "neutral", running: "neutral", skipped: "neutral", waiting_approval: "warning", failed: "danger" } as const

/** The recent runs of one automation: when, what happened, the message, and why. */
export const RunsList = ({ runs }: RunsListProps) => {
  const t = useT(dict)
  const locale = useLocale()
  const when = (iso: string) => new Date(iso).toLocaleString(intlLocale(locale), { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  const label = (r: AutomationRunView) =>
    r.status === "done" ? (r.message ? t("runSent") : t("runDone"))
    : r.status === "waiting_approval" ? t("runWaiting")
    : r.status === "skipped" ? t("runSkipped")
    : r.status === "failed" ? t("runFailed")
    : t("runRunning")

  return (
    <section className={SECTION_CLASS} aria-label={t("runsTitle")}>
      <Text weight="semibold">{t("runsTitle")}</Text>
      {runs.length === 0 ? <Text size="sm" tone="muted">{t("runsEmpty")}</Text> : null}
      <div>
        {runs.map((r) => (
          <div key={r.id} className={RUN_ROW_CLASS}>
            <div className={RUN_HEAD_CLASS}>
              <Badge isDot tone={TONE[r.status]}>{label(r)}</Badge>
              <Text size="xs" tone="muted">{when(r.createdAt)}</Text>
              {r.status === "waiting_approval" ? <Link href="/decisions" className={`${LINK_CLASS} text-xs`}>{t("runOpenDecisions")}</Link> : null}
            </div>
            <Text size="sm">{r.summary}</Text>
            {r.status === "failed" && r.error ? <Text size="sm" tone="muted">{r.error}</Text> : null}
            {r.message || r.evidence ? (
              <details className={DISCLOSURE_CLASS}>
                <summary>{t("runMore")}</summary>
                <div className={DISCLOSURE_BODY_CLASS}>
                  {r.message ? <div><Text size="xs" tone="muted">{t("runMessage")}</Text><p className="whitespace-pre-line">{r.message}</p></div> : null}
                  {r.evidence ? <div><Text size="xs" tone="muted">{t("runEvidence")}</Text><p className="whitespace-pre-line">{r.evidence}</p></div> : null}
                </div>
              </details>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
