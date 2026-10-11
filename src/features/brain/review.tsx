"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Badge, Button, EmptyNotice, Input, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"
import { chooseFactAction, decideFact, decideLessonAction, keepCurrentAction, splitFactAction } from "@/lib/brain/actions"
import { planReview, type ConflictGroup } from "@/lib/brain/conflicts"
import { suggestResolution, type Fact, type Lesson, type Resolution } from "@/lib/brain/shared"
import { BUTTONS_CLASS, COMPARE_CLASS, OPTIONS_CLASS, OPTION_CLASS, STACK_CLASS } from "./classNames"
import { dateOf, sourceLabel, type Lens } from "./shared"

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

/** Where a value was read: the document (or other source), its quote and the date, for the last two pieces of evidence. */
const Provenance = ({ f }: { readonly f: Fact }) => {
  const t = useT(brain)
  const locale = useLocale()
  return (
    <>
      {f.evidence.slice(-2).map((e) => (
        <div key={`${e.kind}:${e.ref}`} className={COMPARE_CLASS}>
          <Text size="xs" tone="muted">{t("optionSource", { source: e.label })} · {t("optionDate", { date: dateOf(e.at ?? f.proposedAt, locale) })}</Text>
          {e.quote ? <Text size="xs" tone="muted">&ldquo;{e.quote}&rdquo;</Text> : null}
        </div>
      ))}
      {f.evidence.length === 0 ? <Text size="xs" tone="muted">{t("by", { who: f.proposedBy, source: sourceLabel(t, f.sourceKind), trust: String(f.trust) })} · {t("optionDate", { date: dateOf(f.proposedAt, locale) })}</Text> : null}
      {f.validFrom ? <Text size="xs" tone="muted">{t("since", { date: dateOf(f.validFrom, locale) })}</Text> : null}
    </>
  )
}

/**
 * Several waiting values for ONE subject + attribute (two documents disagree, or one says "5k" today and "7k" later): one card, the competing
 * values side by side with their document, quote and date. Choosing one applies it and rejects the others with a note.
 */
const ConflictCard = ({ g }: { readonly g: ConflictGroup }) => {
  const t = useT(brain)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [note, setNote] = useState<Note | null>(null)
  const [done, setDone] = useState(false)
  const first = g.options[0] as Fact
  const finish = (text: string) => {
    setDone(true)
    setNote({ tone: "affirmative", text })
    router.refresh()
  }
  const pick = (id: string) => startTransition(async () => {
    const r = await chooseFactAction(id)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    finish(t("picked"))
  })
  const keep = () => startTransition(async () => {
    const r = await keepCurrentAction(first.subjectKey, first.attribute)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    finish(t("keptCurrent"))
  })
  const stop = (retireId: string) => startTransition(async () => {
    const r = await decideFact(retireId, "apply")
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    finish(t("retiredDone"))
  })
  return (
    <ListRow
      title={`${g.subjectLabel} · ${g.attributeLabel}`}
      description={t("conflictGroupHint", { n: String(g.options.length) })}
      badges={<Badge tone="danger">{t("conflictGroup")}</Badge>}
    >
      <div className={STACK_CLASS}>
        <div className={OPTIONS_CLASS}>
          {g.current ? (
            <div className={OPTION_CLASS}>
              <Badge tone="neutral">{t("conflictOptionCurrent")}</Badge>
              <Text size="sm" weight="semibold">{g.current.value}</Text>
              <Provenance f={g.current} />
            </div>
          ) : null}
          {g.options.map((o, i) => (
            <div key={o.id} className={OPTION_CLASS}>
              <Text size="xs" tone="muted">{t("conflictOption", { n: String(i + 1) })}</Text>
              <Text size="sm" weight="semibold">{o.value}{o.unit ? ` ${o.unit}` : ""}</Text>
              <Provenance f={o} />
              {done ? null : <Button variant="primary" size="sm" isPending={isPending} onPress={() => pick(o.id)}>{t("pickValue")}</Button>}
            </div>
          ))}
        </div>
        {done ? null : (
          <div className={BUTTONS_CLASS}>
            {g.current ? <Button variant="outline" size="sm" isDisabled={isPending} onPress={keep}>{t("keepCurrentValue")}</Button> : <Button variant="ghost" size="sm" isDisabled={isPending} onPress={keep}>{t("reject")}</Button>}
            {g.retire ? <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => stop((g.retire as Fact).id)}>{t("retireApply")}</Button> : null}
          </div>
        )}
        {note ? <Alert tone={note.tone} title={note.text} /> : null}
      </div>
    </ListRow>
  )
}

/** An active value whose only source (a document) changed or was deleted: stop using it, or keep it. Nothing is retired without the owner. */
const RetireRow = ({ p, current }: { readonly p: Fact; readonly current: Fact | null }) => {
  const t = useT(brain)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [note, setNote] = useState<Note | null>(null)
  const [done, setDone] = useState(false)
  const act = (to: "apply" | "reject") => startTransition(async () => {
    const r = await decideFact(p.id, to, to === "reject" ? t("retireKept") : "")
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    setDone(true)
    setNote({ tone: "affirmative", text: to === "apply" ? t("retiredDone") : t("retireKept") })
    router.refresh()
  })
  return (
    <ListRow
      title={`${p.subjectLabel} · ${p.attributeLabel}`}
      description={t("retireBody", { value: current?.value ?? p.value })}
      badges={<Badge tone="warning">{t("retireBadge")}</Badge>}
    >
      <div className={STACK_CLASS}>
        {p.evidence.map((e) => <Text key={`${e.kind}:${e.ref}`} size="xs" tone="muted">{e.label}</Text>)}
        {done ? null : (
          <div className={BUTTONS_CLASS}>
            <Button variant="primary" size="sm" isPending={isPending} onPress={() => act("apply")}>{t("retireApply")}</Button>
            <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => act("reject")}>{t("retireKeep")}</Button>
          </div>
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

/** Everything waiting for the owner: conflicts first (one card per key), then single proposals, "no source left" rows and proposed lessons. */
export const ReviewPanel = ({ facts, lessons, lenses }: ReviewPanelProps) => {
  const t = useT(brain)
  const plan = planReview(facts)
  const waitingLessons = lessons.filter((l) => l.status === "proposed")
  const agentName = (m: string | null) => (m === null ? t("lessonsAll") : lenses.find((l) => l.module === m)?.name ?? m)
  const total = plan.cards + waitingLessons.length
  return (
    <SurfaceListCard
      label={`${t("tabReview")} (${total})`}
      headingLevel={2}
      empty={<EmptyNotice message={t("reviewEmptyTitle")} description={t("reviewEmptyBody")} />}
    >
      {total === 0 ? null : (
        <>
          {plan.groups.map((g) => <ConflictCard key={g.key} g={g} />)}
          {plan.singles.map(({ p, current }) => <ProposalRow key={p.id} p={p} current={current} />)}
          {plan.retires.map(({ p, current }) => <RetireRow key={p.id} p={p} current={current} />)}
          {waitingLessons.map((l) => <LessonRow key={l.id} l={l} agent={agentName(l.module)} />)}
        </>
      )}
    </SurfaceListCard>
  )
}
