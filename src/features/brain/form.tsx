"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Button, CheckboxGroup, Drawer, Form, Input, RadioGroup, Select, Textarea } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"
import { saveFact } from "@/lib/brain/actions"
import { SUBJECT_TYPES, type Fact, type Scope, type SubjectType } from "@/lib/brain/shared"
import { FORM_CLASS, FORM_ROW_CLASS } from "./classNames"
import { typeLabel, type Lens } from "./shared"

/** Props for {@link FactDrawer}. */
export type FactDrawerProps = {
  readonly isOpen: boolean
  /** The fact getting a new value; null adds a new fact. */
  readonly editing: Fact | null
  readonly lenses: ReadonlyArray<Lens>
  readonly onClose: (message?: string) => void
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "")

/** Add a fact, or a new value for one (the old value is kept in history). Owners and managers apply directly. */
export const FactDrawer = ({ isOpen, editing, lenses, onClose }: FactDrawerProps) => {
  const t = useT(brain)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState(() => ({
    subjectType: editing?.subjectType ?? ("business" as SubjectType),
    subjectLabel: editing?.subjectLabel ?? "",
    attributeLabel: editing?.attributeLabel ?? "",
    value: "",
    scope: editing?.scope ?? ("internal" as Scope),
    modules: [...(editing?.modules ?? [])],
    validFrom: "",
    validTo: day(editing?.validTo ?? null),
    note: "",
  }))
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = () => startTransition(async () => {
    setError(null)
    const r = await saveFact({
      ...f, validFrom: f.validFrom ? new Date(f.validFrom).toISOString() : null, validTo: f.validTo ? new Date(f.validTo).toISOString() : null,
    })
    if (!r.ok) return setError(r.error)
    router.refresh()
    onClose(r.data.outcome === "reinforced" ? t("reinforced") : t("saved"))
  })

  const title = editing ? t("formTitleEdit", { subject: editing.subjectLabel, attribute: editing.attributeLabel }) : t("formTitleNew")
  return (
    <Drawer isOpen={isOpen} onOpenChange={(o) => { if (!o) onClose() }} title={title} closeLabel={t("cancel")} placement="right"
      footer={(close) => (
        <>
          <Button variant="primary" isPending={isPending} isDisabled={!f.subjectLabel.trim() || !f.attributeLabel.trim() || !f.value.trim()} onPress={submit}>{t("save")}</Button>
          <Button variant="ghost" onPress={close}>{t("cancel")}</Button>
        </>
      )}
    >
      <Form label={title} onSubmit={submit} isPending={isPending}>
        <div className={FORM_CLASS}>
          {error ? <Alert tone="negative" title={error} /> : null}
          {editing ? null : (
            <>
              <Select label={t("fSubjectType")} value={f.subjectType} variant="secondary"
                options={SUBJECT_TYPES.map((k) => ({ id: k, label: typeLabel(t, k) }))} onValueChange={(v) => set("subjectType", (v ?? "business") as SubjectType)} />
              <Input id="brain-subject" name="subject" label={t("fSubject")} hint={t("fSubjectHint")} variant="secondary" value={f.subjectLabel} onValueChange={(v) => set("subjectLabel", v)} isRequired />
              <Input id="brain-attribute" name="attribute" label={t("fAttribute")} hint={t("fAttributeHint")} variant="secondary" value={f.attributeLabel} onValueChange={(v) => set("attributeLabel", v)} isRequired />
            </>
          )}
          <Textarea id="brain-value" label={editing ? `${t("fValue")} (${editing.value})` : t("fValue")} variant="secondary" rows={2} value={f.value} onValueChange={(v) => set("value", v)} />
          <RadioGroup label={t("fScope")} value={f.scope} onValueChange={(v) => set("scope", (v === "public" || v === "restricted" ? v : "internal") as Scope)}
            options={[
              { value: "public", label: t("scopePublic"), description: t("scopePublicHint") },
              { value: "internal", label: t("scopeInternal"), description: t("scopeInternalHint") },
              { value: "restricted", label: t("scopeRestricted"), description: t("scopeRestrictedHint") },
            ]} />
          {f.scope === "restricted" ? (
            <CheckboxGroup label={t("fModules")} value={f.modules} onValueChange={(v) => set("modules", [...v])}
              options={lenses.filter((l) => l.audience === "internal").map((l) => ({ value: l.module, label: l.name }))} />
          ) : null}
          <div className={FORM_ROW_CLASS}>
            <Input id="brain-from" name="validFrom" label={t("fValidFrom")} variant="secondary" placeholder="2026-11-01" value={f.validFrom} onValueChange={(v) => set("validFrom", v)} />
            <Input id="brain-to" name="validTo" label={t("fValidTo")} variant="secondary" placeholder="2026-12-31" value={f.validTo} onValueChange={(v) => set("validTo", v)} />
          </div>
          <Input id="brain-note" name="note" label={t("fNote")} variant="secondary" value={f.note} onValueChange={(v) => set("note", v)} />
        </div>
      </Form>
    </Drawer>
  )
}
