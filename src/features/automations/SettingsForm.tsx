"use client"

import { useState } from "react"
import { Time } from "@internationalized/date"
import { Button, Input, NumberField, Switch, TimeField } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import type { AutomationCardView, ConfigValue } from "@/lib/automation-shared"
import { ACTIONS_CLASS, FIELDS_CLASS, SECTION_CLASS } from "./classNames"
import { loc } from "./helpers"

/** Props for {@link SettingsForm}. */
export type SettingsFormProps = { readonly card: AutomationCardView; readonly busy: boolean; readonly onSave: (values: Record<string, ConfigValue>) => Promise<boolean> }

const toTime = (v: ConfigValue | undefined): Time => {
  const [h, m] = String(v ?? "00:00").split(":").map(Number)
  return new Time(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0)
}
const pad = (n: number) => String(n).padStart(2, "0")

/** The template's own settings (numbers, text, a time, a yes/no), straight from its definition. */
export const SettingsForm = ({ card, busy, onSave }: SettingsFormProps) => {
  const t = useT(dict)
  const locale = useLocale()
  const [values, setValues] = useState<Record<string, ConfigValue>>({ ...card.config })
  const [saved, setSaved] = useState(false)
  if (card.def.settings.length === 0) return null

  const set = (key: string, v: ConfigValue) => {
    setSaved(false)
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  return (
    <section className={SECTION_CLASS} aria-label={t("settingsTitle")}>
      <div className={FIELDS_CLASS}>
        {card.def.settings.map((f) => {
          const label = f.kind === "number" && f.suffix ? `${loc(f.label, locale)} (${loc(f.suffix, locale)})` : loc(f.label, locale)
          const description = f.hint ? loc(f.hint, locale) : undefined
          const id = `${card.key}-${f.key}`
          if (f.kind === "number") {
            return <NumberField key={f.key} id={id} name={f.key} label={label} description={description} minValue={f.min} maxValue={f.max} value={Number(values[f.key] ?? f.min)} isDisabled={busy} onValueChange={(v) => set(f.key, Number.isFinite(v) ? v : f.min)} />
          }
          if (f.kind === "time") {
            return <TimeField key={f.key} name={f.key} label={label} description={description} granularity="minute" hourCycle={24} value={toTime(values[f.key])} isDisabled={busy} onValueChange={(v) => v && set(f.key, `${pad(v.hour)}:${pad(v.minute)}`)} />
          }
          if (f.kind === "toggle") {
            return <Switch key={f.key} name={f.key} label={label} description={description} isSelected={values[f.key] === true} isDisabled={busy} onSelectedChange={(v) => set(f.key, v)} />
          }
          return <Input key={f.key} id={id} name={f.key} label={label} hint={description} variant="secondary" value={String(values[f.key] ?? "")} isDisabled={busy} onValueChange={(v) => set(f.key, v.slice(0, f.maxLength))} />
        })}
      </div>
      <div className={ACTIONS_CLASS}>
        <Button variant="secondary" isPending={busy} onPress={() => void onSave(values).then(setSaved)}>{t("save")}</Button>
        {saved ? <span role="status" className="text-sm text-success">{t("saved")}</span> : null}
      </div>
    </section>
  )
}
