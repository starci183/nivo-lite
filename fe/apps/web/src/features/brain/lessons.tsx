"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Badge, Button, Drawer, EmptyNotice, Form, Input, ListRow, Select, SurfaceListCard, Text, Textarea } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"
import { mineLessonsAction, retireLessonAction, saveLesson } from "@/lib/brain/actions"
import { lessonFor, type Lesson } from "@/lib/brain/shared"
import { FORM_CLASS, STACK_CLASS, TOOLBAR_CLASS, TOOLBAR_GROW_CLASS } from "./classNames"
import type { Lens } from "./shared"

/** Props for {@link LessonsPanel}. */
export type LessonsPanelProps = {
  readonly lessons: ReadonlyArray<Lesson>
  readonly lenses: ReadonlyArray<Lens>
  readonly canWrite: boolean
}

type Note = { readonly tone: "affirmative" | "negative" | "informative"; readonly text: string }

/** How each agent should work: its active lessons (own and shared), learning from the owner's edits, and lessons written by hand. */
export const LessonsPanel = ({ lessons, lenses, canWrite }: LessonsPanelProps) => {
  const t = useT(brain)
  const router = useRouter()
  const [module, setModule] = useState<string>(lenses[0]?.module ?? "")
  const [note, setNote] = useState<Note | null>(null)
  const [isPending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: "", body: "", appliesWhen: "", shared: false })

  const shown = lessons.filter((l) => (l.status === "active" || l.status === "retired") && (module ? lessonFor(l, module) : true))
  const mine = () => startTransition(async () => {
    const r = await mineLessonsAction(module)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    const m = r.data
    setNote(m.reason === "not_enough" ? { tone: "informative", text: t("mineNotEnough", { n: String(m.corrections) }) }
      : m.reason === "model_unavailable" ? { tone: "negative", text: t("mineUnavailable") }
      : { tone: "affirmative", text: t("mineDone", { n: String(m.proposed), c: String(m.corrections), k: String(m.newCases) }) })
    router.refresh()
  })
  const add = () => startTransition(async () => {
    const r = await saveLesson({ module: form.shared ? null : module, title: form.title, body: form.body, appliesWhen: form.appliesWhen })
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    setAdding(false)
    setForm({ title: "", body: "", appliesWhen: "", shared: false })
    setNote({ tone: "affirmative", text: t("saved") })
    router.refresh()
  })
  const retire = (id: string) => startTransition(async () => {
    const r = await retireLessonAction(id)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    router.refresh()
  })

  return (
    <div className={STACK_CLASS}>
      <Text size="sm" tone="muted">{t("lessonsIntro")}</Text>
      <div className={TOOLBAR_CLASS}>
        <div className={TOOLBAR_GROW_CLASS}>
          <Select label={t("lessonsAgent")} variant="secondary" value={module} options={lenses.map((l) => ({ id: l.module, label: l.name }))} onValueChange={(v) => setModule(v ?? "")} />
        </div>
        {canWrite ? <Button variant="primary" isPending={isPending} isDisabled={!module} onPress={mine}>{t("mine")}</Button> : null}
        {canWrite ? <Button variant="outline" onPress={() => setAdding(true)}>{t("addLesson")}</Button> : null}
      </div>
      {note ? <Alert tone={note.tone} title={note.text} /> : null}
      <SurfaceListCard label={lenses.find((l) => l.module === module)?.name ?? t("tabLessons")} headingLevel={2} empty={<EmptyNotice message={t("lessonsEmpty")} />}>
        {shown.length === 0 ? null : shown.map((l) => (
          <ListRow
            key={l.id}
            title={l.title}
            description={l.module === null ? t("lessonsAll") : l.appliesWhen || undefined}
            badges={<Badge tone={l.status === "active" ? "success" : "neutral"}>{l.status === "active" ? t("statusActive") : t("statusRetired")}</Badge>}
            actions={canWrite && l.status === "active" ? <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => retire(l.id)}>{t("retireLesson")}</Button> : undefined}
          >
            <Text size="sm">{l.body}</Text>
          </ListRow>
        ))}
      </SurfaceListCard>
      <Drawer isOpen={adding} onOpenChange={setAdding} title={t("addLesson")} closeLabel={t("cancel")} placement="right"
        footer={(close) => (
          <>
            <Button variant="primary" isPending={isPending} isDisabled={!form.title.trim() || !form.body.trim()} onPress={add}>{t("save")}</Button>
            <Button variant="ghost" onPress={close}>{t("cancel")}</Button>
          </>
        )}
      >
        <Form label={t("addLesson")} onSubmit={add} isPending={isPending}>
          <div className={FORM_CLASS}>
            <Input id="lesson-title" name="title" label={t("lTitle")} variant="secondary" value={form.title} onValueChange={(v) => setForm((p) => ({ ...p, title: v }))} isRequired />
            <Textarea id="lesson-body" label={t("lBody")} variant="secondary" rows={3} value={form.body} onValueChange={(v) => setForm((p) => ({ ...p, body: v }))} />
            <Input id="lesson-when" name="when" label={t("lWhen")} variant="secondary" value={form.appliesWhen} onValueChange={(v) => setForm((p) => ({ ...p, appliesWhen: v }))} />
            <Select label={t("lessonsAgent")} variant="secondary" value={form.shared ? "all" : module}
              options={[...lenses.map((l) => ({ id: l.module, label: l.name })), { id: "all", label: t("lessonsAll") }]}
              onValueChange={(v) => { if (v === "all") setForm((p) => ({ ...p, shared: true })); else { setForm((p) => ({ ...p, shared: false })); setModule(v ?? module) } }} />
          </div>
        </Form>
      </Drawer>
    </div>
  )
}
