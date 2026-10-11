"use client"

import { useMemo, useState } from "react"
import { Checkbox, CheckboxGroup, Input, Select, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectorOpenapi } from "@/i18n/dict/connectorOpenapi"
import { COLUMN_CLASS, LIST_CLASS, NESTED_CLASS, ROW_CLASS } from "./classNames"
import { isPullable, opLabel, PULL_ENTITIES, type OpDef, type PullConfig, type PullEntity } from "./spec"

const SHOWN = 200
const matches = (op: OpDef, q: string) => !q || `${op.method} ${op.path} ${op.summary}`.toLowerCase().includes(q.toLowerCase())

/** Step "Dữ liệu kéo về": tick the GET operations NIVO pulls on a schedule, and map their response. */
export type PullsStepProps = {
  readonly ops: ReadonlyArray<OpDef>
  readonly pulls: ReadonlyArray<PullConfig>
  readonly onPull: (op: OpDef, pull: PullConfig | null) => void
  readonly isDisabled?: boolean
}

export const PullsStep = ({ ops, pulls, onPull, isDisabled }: PullsStepProps) => {
  const t = useT(connectorOpenapi)
  const [query, setQuery] = useState("")
  const gets = useMemo(() => ops.filter((o) => o.method === "GET" && matches(o, query)), [ops, query])
  const byOp = new Map(pulls.map((p) => [p.opId, p]))
  const set = (p: PullConfig, patch: Partial<PullConfig>) => {
    const op = ops.find((o) => o.id === p.opId)
    if (op) onPull(op, { ...p, ...patch })
  }

  return (
    <div className={COLUMN_CLASS}>
      <Text size="sm" tone="muted">{t("pullsHint")}</Text>
      <Input id="oa-pull-search" name="pullSearch" label={t("search")} variant="secondary" value={query} onValueChange={setQuery} />
      {gets.length === 0 ? <Text size="sm">{t("noGets")}</Text> : null}
      <div className={LIST_CLASS}>
        {gets.slice(0, SHOWN).map((op) => {
          const pull = byOp.get(op.id)
          const ok = isPullable(op)
          return (
            <div key={op.id} className={ROW_CLASS}>
              <Checkbox
                label={opLabel(op)}
                description={ok ? op.summary || undefined : t("needsPath")}
                isDisabled={isDisabled || !ok}
                isSelected={Boolean(pull)}
                onSelectedChange={(on) => onPull(op, on ? { opId: op.id, entity: "other", itemsPath: op.suggest?.itemsPath ?? "", idField: op.suggest?.idField ?? "", titleField: op.suggest?.titleField ?? "", fixedQuery: "" } : null)}
              />
              {pull ? (
                <div className={NESTED_CLASS}>
                  <Select
                    label={t("entity")} variant="secondary" isDisabled={isDisabled}
                    options={PULL_ENTITIES.map((e) => ({ id: e, label: t(`entity_${e}`) }))}
                    value={pull.entity} onValueChange={(v) => v && set(pull, { entity: v as PullEntity })}
                  />
                  <Input id={`oa-path-${op.id}`} name="itemsPath" label={t("itemsPath")} variant="secondary" hint={t("itemsPathHint")} isDisabled={isDisabled} value={pull.itemsPath} onValueChange={(v) => set(pull, { itemsPath: v })} />
                  <Input id={`oa-id-${op.id}`} name="idField" label={t("idField")} variant="secondary" isDisabled={isDisabled} value={pull.idField} onValueChange={(v) => set(pull, { idField: v })} />
                  <Input id={`oa-title-${op.id}`} name="titleField" label={t("titleField")} variant="secondary" isDisabled={isDisabled} value={pull.titleField} onValueChange={(v) => set(pull, { titleField: v })} />
                  {op.params.some((p) => p.in === "query" && p.required) ? (
                    <Input id={`oa-q-${op.id}`} name="fixedQuery" label={t("fixedQuery")} variant="secondary" hint={t("fixedQueryHint", { names: op.params.filter((p) => p.in === "query" && p.required).map((p) => p.name).join(", ") })} isDisabled={isDisabled} value={pull.fixedQuery} onValueChange={(v) => set(pull, { fixedQuery: v })} />
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {gets.length > SHOWN ? <Text size="sm" tone="muted">{t("tooMany", { n: SHOWN })}</Text> : null}
    </div>
  )
}

/** Step "API cho agent": tick the operations agents may call as tools (any method). */
export type ToolsStepProps = {
  readonly ops: ReadonlyArray<OpDef>
  readonly tools: ReadonlyArray<string>
  readonly onTools: (ids: ReadonlyArray<string>) => void
  readonly isDisabled?: boolean
}

export const ToolsStep = ({ ops, tools, onTools, isDisabled }: ToolsStepProps) => {
  const t = useT(connectorOpenapi)
  const [query, setQuery] = useState("")
  const visible = useMemo(() => ops.filter((o) => matches(o, query)).slice(0, SHOWN), [ops, query])
  const visibleIds = new Set(visible.map((o) => o.id))
  return (
    <div className={COLUMN_CLASS}>
      <Text size="sm" tone="muted">{t("toolsHint")}</Text>
      <Input id="oa-tool-search" name="toolSearch" label={t("search")} variant="secondary" value={query} onValueChange={setQuery} />
      {visible.length === 0 ? <Text size="sm">{t("noOps")}</Text> : (
        <div className={LIST_CLASS}>
          <CheckboxGroup
            variant="secondary" label={t("toolsLabel")} isLabelHidden isDisabled={isDisabled}
            options={visible.map((o) => ({ value: o.id, label: opLabel(o), description: o.method === "GET" ? o.summary || undefined : `${o.summary ? `${o.summary} · ` : ""}${t("alwaysAsk")}` }))}
            value={tools.filter((id) => visibleIds.has(id))}
            onValueChange={(v) => onTools([...tools.filter((id) => !visibleIds.has(id)), ...v])}
          />
        </div>
      )}
    </div>
  )
}
