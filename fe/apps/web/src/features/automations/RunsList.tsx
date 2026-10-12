"use client"

import { Badge, Disclosure, Heading, List, ListItem, Text, TextAction } from "@starci/grammar/common"
import { intlLocale, TIME_ZONE } from "@/i18n/core"
import { useLocale, useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import type { AutomationRunView } from "@/lib/automation-shared"
import { FACTS_CLASS, PRESERVE_LINES_CLASS, ROWS_CLASS, RUN_HEAD_CLASS, RUN_ROW_CLASS, SECTION_CLASS } from "./classNames"

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
      <Heading level={3}>{t("runsTitle")}</Heading>
      {runs.length === 0 ? <Text size="sm" tone="muted">{t("runsEmpty")}</Text> : null}
      {runs.length > 0 ? (
        <List label={t("runsTitle")} className={ROWS_CLASS}>
        {runs.map((r) => (
          <ListItem key={r.id} className={RUN_ROW_CLASS}>
            <div className={RUN_HEAD_CLASS}>
              <Badge isDot tone={TONE[r.status]}>{label(r)}</Badge>
              <Text size="xs" tone="muted">{when(r.createdAt)}</Text>
              {r.status === "waiting_approval" ? <TextAction href="/decisions" size="xs" appearance="inline">{t("runOpenDecisions")}</TextAction> : null}
            </div>
            <Text size="sm">{r.summary}</Text>
            {r.status === "failed" && r.error ? <Text size="sm" tone="muted">{r.error}</Text> : null}
            {r.message || r.evidence ? (
              <Disclosure title={t("runMore")} headingLevel={4}>
                <div className={FACTS_CLASS}>
                  {r.message ? <div className={FACTS_CLASS}><Text size="xs" tone="muted">{t("runMessage")}</Text><div className={PRESERVE_LINES_CLASS}><Text size="sm">{r.message}</Text></div></div> : null}
                  {r.evidence ? <div className={FACTS_CLASS}><Text size="xs" tone="muted">{t("runEvidence")}</Text><div className={PRESERVE_LINES_CLASS}><Text size="sm">{r.evidence}</Text></div></div> : null}
                </div>
              </Disclosure>
            ) : null}
          </ListItem>
        ))}
        </List>
      ) : null}
    </section>
  )
}
