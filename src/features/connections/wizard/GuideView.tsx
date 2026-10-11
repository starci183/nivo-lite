"use client"

import { Field, Fieldset, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { fill, tokenValue, type GuideContext, type GuideItem, type GuideStep, type Token } from "@/lib/connection-providers"
import { useCopyField } from "../useCopyField"
import { ITEMS_CLASS } from "./classNames"

/** Props for {@link GuideView}. */
export type GuideViewProps = {
  readonly brand: string
  readonly steps: ReadonlyArray<GuideStep>
  readonly ctx: GuideContext
  /** Values the owner pastes from the provider (payOS keys, Casso key). */
  readonly values: Readonly<Record<string, string>>
  readonly onValue: (field: string, value: string) => void
  /** Values NIVO owns that the owner may change here (webhook name, SePay API key); the field shows the draft value. */
  readonly editable?: Partial<Record<Token, { readonly value: string; readonly onChange: (value: string) => void }>>
  readonly isDisabled?: boolean
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** A stable id fragment from a provider label. */
const slug = (label: string) => label.normalize("NFD").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()

/** The provider's own screens, one nested Grammar surface each (BOUNDARY-5 case-1), field by field: values to copy, plain "Chọn X" for choices, boxes to paste into. */
export const GuideView = ({ brand, steps, ctx, values, onValue, editable, isDisabled }: GuideViewProps) => {
  const t = useT(connectionWizard)
  const locale = useLocale()
  const copy = useCopyField()

  const item = (it: GuideItem, i: number) => {
    if (it.kind === "copy") {
      const edit = editable?.[it.token]
      const hint = edit ? t("guideCopyEdit", { brand }) : t("guideCopyHint", { brand })
      return (
        <Input
          key={i} id={`guide-${it.token}`} name={it.token} label={it.label} hint={hint} variant="secondary" kind={it.secret ? "password" : "text"}
          value={edit ? edit.value : tokenValue(it.token, ctx)} isReadOnly={!edit} isDisabled={isDisabled}
          {...copy}
          {...(edit ? { onValueChange: edit.onChange } : {})}
        />
      )
    }
    if (it.kind === "paste") {
      return (
        <Input
          key={i} id={`guide-${it.field}`} name={it.field} label={it.label} variant="secondary" kind={it.secret ? "password" : "text"}
          hint={it.hint?.[locale]} isDisabled={isDisabled} value={values[it.field] ?? ""} onValueChange={(v) => onValue(it.field, v)}
        />
      )
    }
    if (it.kind === "note") return <Text key={i} size="sm" tone="muted">{it.text[locale]}</Text>
    const answer = it.kind === "choose" ? t("guideChoose", { option: fill(it.option, ctx) }) : cap(t("guideSwitch", { state: it.state[locale] }))
    return (
      <Field key={i} id={`guide-${slug(it.label)}-${i}`} label={it.label} isReadOnly>
        {(control) => <output id={control.id} aria-describedby={control["aria-describedby"]}><Text as="span" size="sm" weight="semibold">{answer}</Text></output>}
      </Field>
    )
  }

  return (
    <div className={ITEMS_CLASS}>
      {steps.map((s) => (
        <SurfaceCard key={s.id} depth="nested">
          <Fieldset legend={t("onScreen", { brand, title: s.title })} isDisabled={isDisabled}>{s.items.map(item)}</Fieldset>
        </SurfaceCard>
      ))}
    </div>
  )
}
