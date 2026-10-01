"use client"

import { Input, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { fill, tokenValue, type GuideContext, type GuideItem, type GuideStep } from "@/lib/connection-providers"
import { CopyField } from "../CopyField"
import { ITEMS_CLASS, ITEM_CLASS, OPTION_CLASS, SCREEN_CLASS } from "./classNames"

/** Props for {@link GuideView}. */
export type GuideViewProps = {
  readonly brand: string
  readonly steps: ReadonlyArray<GuideStep>
  readonly ctx: GuideContext
  /** Values the owner pastes from the provider (payOS keys, Casso key). */
  readonly values: Readonly<Record<string, string>>
  readonly onValue: (field: string, value: string) => void
  readonly isDisabled?: boolean
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The provider's own screens, one block each, field by field: values to copy, plain "Chọn X" for choices, boxes to paste into. */
export const GuideView = ({ brand, steps, ctx, values, onValue, isDisabled }: GuideViewProps) => {
  const t = useT(connectionWizard)
  const locale = useLocale()

  const item = (it: GuideItem, i: number) => {
    if (it.kind === "copy") return <CopyField key={i} label={t("guideCopy", { field: it.label })} value={tokenValue(it.token, ctx)} secret={it.secret} />
    if (it.kind === "paste") {
      return (
        <Input
          key={i} id={`guide-${it.field}`} name={it.field} label={it.label} variant="secondary" kind={it.secret ? "password" : "text"}
          hint={it.hint?.[locale]} isDisabled={isDisabled} value={values[it.field] ?? ""} onValueChange={(v) => onValue(it.field, v)}
        />
      )
    }
    if (it.kind === "note") return <Text key={i} size="sm" tone="muted">{it.text[locale]}</Text>
    return (
      <div key={i} className={ITEM_CLASS}>
        <Text size="xs" tone="muted">{it.label}</Text>
        {it.kind === "choose"
          ? <span className={OPTION_CLASS}>{t("guideChoose", { option: fill(it.option, ctx) })}</span>
          : <span className={OPTION_CLASS}>{cap(t("guideSwitch", { state: it.state[locale] }))}</span>}
      </div>
    )
  }

  return (
    <div className={ITEMS_CLASS}>
      {steps.map((s) => (
        <div key={s.id} className={SCREEN_CLASS}>
          <Text size="sm" weight="semibold">{t("onScreen", { brand, title: s.title })}</Text>
          <div className={ITEMS_CLASS}>{s.items.map(item)}</div>
        </div>
      ))}
    </div>
  )
}
