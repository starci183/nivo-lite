"use client"

import { useId } from "react"
import { Input, Label, Select, SurfaceCard, Switch, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { fill, tokenValue, type GuideContext, type GuideItem, type GuideStep, type Token } from "@/lib/connection-providers"
import { useCopyField } from "../useCopyField"
import { SCREENS_CLASS, SCREEN_CLASS, SCREEN_FIELDS_CLASS } from "./classNames"

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

/** A stable id fragment from a provider label. */
const slug = (label: string) => label.normalize("NFD").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()

/**
 * The provider's own screens, one per block: the screen's name as a `Label` outside a nested `SurfaceCard`, and inside it each
 * field drawn as the control the provider shows - values to copy (in-field copy), the choice to make as a read-only `Select`
 * already set to the right option, a setting to turn on as a read-only `Switch`, and the boxes to paste provider values into.
 */
export const GuideView = ({ brand, steps, ctx, values, onValue, editable, isDisabled }: GuideViewProps) => {
  const t = useT(connectionWizard)
  const locale = useLocale()
  const copy = useCopyField()
  const base = useId()

  const item = (it: GuideItem, i: number, screen: string) => {
    const id = `${base}-${screen}-${i}`
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
    if (it.kind === "choose") {
      const option = fill(it.option, ctx)
      return (
        <Select
          key={i} name={id} label={it.label} description={t("guideChooseHint", { brand })} variant="secondary" isReadOnly
          options={[{ id: "provider-option", label: option }]} value="provider-option"
        />
      )
    }
    if (it.kind === "switch") {
      return <Switch key={i} label={it.label} description={t("guideSwitchHint", { brand })} isSelected isReadOnly />
    }
    return <Text key={i} size="sm" tone="muted">{it.text[locale]}</Text>
  }

  return (
    <div className={SCREENS_CLASS}>
      {steps.map((s) => {
        const headingId = `${base}-${slug(s.id)}`
        return (
          <section key={s.id} className={SCREEN_CLASS} aria-labelledby={headingId}>
            <Label as="h4" id={headingId}>{t("onScreen", { brand, title: s.title })}</Label>
            <SurfaceCard depth="nested">
              <div className={SCREEN_FIELDS_CLASS}>{s.items.map((it, i) => item(it, i, slug(s.id)))}</div>
            </SurfaceCard>
          </section>
        )
      })}
    </div>
  )
}
