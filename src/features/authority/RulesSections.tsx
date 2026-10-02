"use client"

import { useState } from "react"
import { CheckboxGroup, Heading, NumberField, SegmentedControl, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { authority as dict } from "@/i18n/dict/authority"
import { governance } from "@/i18n/dict/governance"
import { saveAuthority, saveRule } from "@/lib/flow-actions"
import type { Authority, AuthorityRule, Department, FlowAction, RuleMode } from "@/lib/flow-types"
import { FIELDS_CLASS, GROUP_CLASS, REQUIRED_ROW_CLASS, RULE_LIMIT_CLASS, RULE_LIST_CLASS, RULE_NAME_CLASS, RULE_ROW_CLASS } from "./classNames"
import { AMOUNT_ACTIONS, draftsFrom, FIELD_KEYS, fromField, MODES, modesFor, RULE_MATRIX, ruleKey, toField, visibleGroups, type RuleDraft } from "./model"
import { SaveRow, useSaver } from "./SaveRow"

/** Props for {@link RulesSections}. */
export type RulesSectionsProps = { readonly authority: Authority; readonly rules: ReadonlyArray<AuthorityRule> }

const isMode = (v: string): v is RuleMode => (MODES as ReadonlyArray<string>).includes(v)

/** Sections 3 and 4: the automation scope (mode and VND limit per action) and the limits (note and required details). */
export const RulesSections = ({ authority, rules }: RulesSectionsProps) => {
  const t = useT(dict)
  const g = useT(governance)
  const scopeSaver = useSaver()
  const limitsSaver = useSaver()
  const [baseline, setBaseline] = useState<Record<string, RuleDraft>>(() => draftsFrom(rules))
  const [draft, setDraft] = useState<Record<string, RuleDraft>>(() => draftsFrom(rules))
  const [limitsNote, setLimitsNote] = useState(authority.limits_note)
  const noteOf = (department: Department, action: FlowAction) => rules.find((r) => r.department === department && r.action === action)?.note ?? ""

  const patch = (key: string, next: Partial<RuleDraft>) => setDraft((prev) => ({ ...prev, [key]: { ...prev[key]!, ...next } }))
  const actionName = (action: FlowAction) => g(`action_${action}`)

  const onSaveScope = () =>
    scopeSaver.run(async () => {
      const nextBase = { ...baseline }
      for (const group of RULE_MATRIX) {
        for (const action of group.actions) {
          const key = ruleKey(group.department, action)
          const d = draft[key]!
          const b = baseline[key]!
          if (d.mode === b.mode && d.limit === b.limit) continue
          const result = await saveRule({ department: group.department, action, mode: d.mode, limit_vnd: d.limit, required_fields: [...b.required], note: noteOf(group.department, action) })
          if (!result.ok) return result
          nextBase[key] = { ...b, mode: d.mode, limit: d.limit }
        }
      }
      setBaseline(nextBase)
      return { ok: true as const, data: null }
    })

  const onSaveLimits = () =>
    limitsSaver.run(async () => {
      const noted = await saveAuthority({ limits_note: limitsNote.trim() })
      if (!noted.ok) return noted
      const nextBase = { ...baseline }
      for (const group of RULE_MATRIX) {
        for (const action of group.actions) {
          const key = ruleKey(group.department, action)
          const d = draft[key]!
          const b = baseline[key]!
          if (d.required.join() === b.required.join()) continue
          const result = await saveRule({ department: group.department, action, mode: b.mode, limit_vnd: b.limit, required_fields: [...d.required], note: noteOf(group.department, action) })
          if (!result.ok) return result
          nextBase[key] = { ...b, required: d.required }
        }
      }
      setBaseline(nextBase)
      return { ok: true as const, data: null }
    })

  const groups = visibleGroups(rules)
  const modeOptionsFor = (action: FlowAction) => modesFor(action).map((m) => ({ value: m, label: g(`mode_${m}`) }))
  const fieldOptions = FIELD_KEYS.map((f) => ({ value: f, label: g(`field_${f}`) }))

  return (
    <>
      <SurfaceCard label={t("scopeTitle")} headingLevel={2}>
        <div className={FIELDS_CLASS}>
          <Text size="sm" tone="muted">{t("scopeDesc")}</Text>
          {groups.map((group) => (
            <div key={group.department} className={GROUP_CLASS}>
              <Heading level={3}>{g(`dept_${group.department}`)}</Heading>
              <div className={RULE_LIST_CLASS}>
                {group.actions.map((action) => {
                  const key = ruleKey(group.department, action)
                  const d = draft[key]!
                  return (
                    <div key={key} className={RULE_ROW_CLASS}>
                      <div className={RULE_NAME_CLASS}>
                        <Text weight="medium">{actionName(action)}</Text>
                      </div>
                      <SegmentedControl
                        label={t("modeLabel", { action: actionName(action) })}
                        isLabelHidden
                        options={modeOptionsFor(action)}
                        value={d.mode}
                        onValueChange={(v) => { scopeSaver.reset(); if (isMode(v)) patch(key, { mode: v }) }}
                      />
                      {AMOUNT_ACTIONS.includes(action) ? (
                        <div className={RULE_LIMIT_CLASS}>
                          <NumberField
                            label={t("limitLabel")}
                            minValue={0}
                            step={1_000_000}
                            formatOptions={{ maximumFractionDigits: 0 }}
                            isDisabled={d.mode === "never"}
                            value={toField(d.limit)}
                            onValueChange={(v) => { scopeSaver.reset(); patch(key, { limit: fromField(v) }) }}
                          />
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <Text size="xs" tone="muted">{t("limitHint")}</Text>
          <SaveRow saver={scopeSaver} onSave={onSaveScope} />
        </div>
      </SurfaceCard>

      <SurfaceCard label={t("limitsTitle")} headingLevel={2}>
        <div className={FIELDS_CLASS}>
          <Text size="sm" tone="muted">{t("limitsDesc")}</Text>
          <Textarea label={t("limitsNote")} description={t("limitsNoteHint")} rows={3} value={limitsNote} onValueChange={(v) => { limitsSaver.reset(); setLimitsNote(v) }} />
          <div>
            <Heading level={3}>{t("requiredTitle")}</Heading>
            <Text size="sm" tone="muted">{t("requiredHint")}</Text>
          </div>
          {groups.flatMap((group) => group.actions.map((action) => ({ department: group.department, action }))).map(({ department, action }) => {
            const key = ruleKey(department, action)
            return (
              <div key={key} className={REQUIRED_ROW_CLASS}>
                <CheckboxGroup
                  label={t("requiredFor", { action: `${actionName(action)} · ${g(`dept_${department}`)}` })}
                  orientation="horizontal"
                  options={fieldOptions}
                  value={[...draft[key]!.required]}
                  onValueChange={(v) => { limitsSaver.reset(); patch(key, { required: FIELD_KEYS.filter((f) => v.includes(f)) }) }}
                />
              </div>
            )
          })}
          <SaveRow saver={limitsSaver} onSave={onSaveLimits} />
        </div>
      </SurfaceCard>
    </>
  )
}
