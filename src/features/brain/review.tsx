"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Badge, Button, EmptyNotice, Input, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"
import { decideFact, decideLessonAction, splitFactAction } from "@/lib/brain/actions"
import { suggestResolution, type Fact, type Lesson, type Resolution } from "@/lib/brain/shared"
import { BUTTONS_CLASS, COMPARE_CLASS, STACK_CLASS } from "./classNames"
import { sourceLabel, type Lens } from "./shared"

/** Props for {@link ReviewPanel}. */
export type ReviewPanelProps = {
  readonly facts: ReadonlyArray<Fact>
  readonly lessons: ReadonlyArray<Lesson>
  readonly lenses: ReadonlyArray<Lens>
}

type Note = { readonly tone: "affirmative" | "negative" | "informative"; readonly text: string }

/** One proposal with the current value beside it, its evidence, NIVO's suggestion and the decision buttons. */
const ProposalRow = ({ p, current }: { readonly p: Fact; readonly current: Fact | null }) => {
  const t = useT(brain)
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [note, setNote] = useState<Note | null>(null)
  const [situation, setSituation] = useState("")
  const [done, setDone] = useState(false)
  const s = suggestResolution(p, current)

  const act = (what: Resolution) => {
    if (what === "ask") return setNote({ tone: "informative", text: t("asked", { who: p.proposedBy }) })
    startTransition(async () => {
      const r = what === "split" ? await splitFactAction(p.id, situation) : await decideFact(p.id, what === "reject" ? "reject" : "apply")
      if (!r.ok) return setNote({ tone: "negative", text: r.error })
      setDone(true)
      setNote({ tone: "affirmative", text: what === "split" ? t("splitDone") : what === "reject" ? t("rejected") : t("applied") })
      router.refresh()
    })
  }
  const SUGGEST_LABEL: Readonly<Record<Resolution, string>> = { apply: t("doApply"), schedule: t("doSchedule"), reject: t("doReject"), split: t("doSplit"), ask: t("doAsk") }

  return (
    <ListRow
      title={`${p.subjectLabel} · ${p.attributeLabel}`}
      description={t("by", { who: p.proposedBy, source: sourceLabel(t, p.sourceKind), trust: String(p.trust) })}
      badges={current ? <Badge tone="danger">{t("conflict")}</Badge> : <Badge tone="warning">{t("proposed")}</Badge>}
    >
      <div className={STACK_CLASS}>
        <div className={COMPARE_CLASS}>
          {current ? <Text size="sm" tone="muted">{t("currentValue", { value: current.value })}</Text> : null}
          <Text size="sm" weight="semibold">{t("newValue", { value: p.value })}</Text>
          {p.evidence.slice(-2).map((e) => (
            <Text key={`${e.kind}:${e.ref}`} size="xs" tone="muted">{t("evidence")}: {e.label}{e.quote ? ` · "${e.quote}"` : ""}</Text>
          ))}
        </div>
        {done ? null : (
          <>
            <Alert tone="informative" title={t("suggestion")} description={s.reason[locale]} />
            {s.action === "split" ? (
              <Input id={`split-${p.id}`} name="situation" label={t("situation")} variant="secondary" value={situation} onValueChange={setSituation} />
            ) : null}
            <div className={BUTTONS_CLASS}>
              <Button variant="primary" size="sm" isPending={isPending} isDisabled={s.action === "split" && !situation.trim()} onPress={() => act(s.action)}>{SUGGEST_LABEL[s.action]}</Button>
              {s.action !== "apply" && s.action !== "schedule" ? <Button variant="outline" size="sm" isDisabled={isPending} onPress={() => act("apply")}>{t("apply")}</Button> : null}
              {s.action !== "reject" ? <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => act("reject")}>{t("reject")}</Button> : null}
            </div>
          </>
        )}
        {note ? <Alert tone={note.tone} title={note.text} /> : null}
      </div>
    </ListRow>
  )
}

/** A proposed lesson with approve / reject. */
const LessonRow = ({ l, agent }: { readonly l: Lesson; readonly agent: string }) => {
  const t = useT(brain)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const decide = (to: "active" | "rejected") => startTransition(async () => {
    const r = await decideLessonAction(l.id, to)
    if (!r.ok) return setError(r.error)
    router.refresh()
  })
  return (
    <ListRow
      title={l.title}
      description={t("lessonProposed", { agent })}
      badges={<Badge tone="warning">{t("proposed")}</Badge>}
      actions={<Button variant="outline" size="sm" isPending={isPending} onPress={() => decide("active")}>{t("apply")}</Button>}
    >
      <div className={COMPARE_CLASS}>
        <Text size="sm">{l.body}</Text>
        {l.appliesWhen ? <Text size="xs" tone="muted">{l.appliesWhen}</Text> : null}
        {l.evidence.length ? <Text size="xs" tone="muted">{t("evidence")}: {l.evidence.map((e) => e.label).join(" · ")}</Text> : null}
        <div className={BUTTONS_CLASS}><Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => decide("rejected")}>{t("reject")}</Button></div>
        {error ? <Alert tone="negative" title={error} /> : null}
      </div>
    </ListRow>
  )
}

/** Everything waiting for the owner: fact proposals (conflicts first) and proposed lessons. */
export const ReviewPanel = ({ facts, lessons, lenses }: ReviewPanelProps) => {
  const t = useT(brain)
  const active = new Map(facts.filter((f) => f.status === "active").map((f) => [`${f.subjectKey}|${f.attribute}`, f]))
  const proposals = facts.filter((f) => f.status === "proposed")
    .map((p) => ({ p, current: active.get(`${p.subjectKey}|${p.attribute}`) ?? null }))
    .sort((a, b) => Number(b.current !== null) - Number(a.current !== null) || b.p.proposedAt.localeCompare(a.p.proposedAt))
  const waitingLessons = lessons.filter((l) => l.status === "proposed")
  const agentName = (m: string | null) => (m === null ? t("lessonsAll") : lenses.find((l) => l.module === m)?.name ?? m)
  const total = proposals.length + waitingLessons.length
  return (
    <SurfaceListCard
      label={`${t("tabReview")} (${total})`}
      headingLevel={2}
      empty={<EmptyNotice message={t("reviewEmptyTitle")} description={t("reviewEmptyBody")} />}
    >
      {total === 0 ? null : (
        <>
          {proposals.map(({ p, current }) => <ProposalRow key={p.id} p={p} current={current} />)}
          {waitingLessons.map((l) => <LessonRow key={l.id} l={l} agent={agentName(l.module)} />)}
        </>
      )}
    </SurfaceListCard>
  )
}
