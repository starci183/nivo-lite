"use client"

import { useState, useTransition } from "react"
import { Alert, Button, CheckboxGroup, Select, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectorDatabase } from "@/i18n/dict/connectorDatabase"
import { previewDatabaseTable } from "@/lib/connectors/database-actions"
import { BUTTONS_CLASS, SCREEN_FIELDS_CLASS } from "../../classNames"
import { DB_ENTITIES, MAX_COLUMNS, tableKey, type DbEntity, type DbTarget, type PreviewRows, type TableInfo, type TableMapping } from "./types"

const NONE = "__none"

/** Props for {@link TableMapper}. */
export type TableMapperProps = {
  readonly table: TableInfo
  readonly mapping: TableMapping
  readonly onChange: (next: TableMapping) => void
  readonly connectionId?: string
  readonly target: DbTarget
  readonly isDisabled?: boolean
}

/** One picked table: what its rows are, the id / title / updated-at columns, the columns to bring, and a 5-row preview. */
export const TableMapper = ({ table, mapping, onChange, connectionId, target, isDisabled }: TableMapperProps) => {
  const t = useT(connectorDatabase)
  const [rows, setRows] = useState<PreviewRows | null>(null)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()
  const names = table.columns.map((c) => ({ id: c.name, label: `${c.name} (${c.type})` }))
  const optional = [{ id: NONE, label: t("colNone") }, ...names]
  const set = (patch: Partial<TableMapping>) => onChange({ ...mapping, ...patch })
  const id = `db-${tableKey({ schema: table.schema, name: table.name }).replace(/\W/g, "-")}`

  const load = () => {
    setError("")
    startTransition(async () => {
      const r = await previewDatabaseTable({ connectionId, target, mapping })
      if (r.ok) setRows(r.data)
      else { setRows(null); setError(r.error) }
    })
  }

  return (
    <SurfaceCard depth="nested">
      <div className={SCREEN_FIELDS_CLASS}>
        <Text size="sm" weight="semibold">{tableKey({ schema: table.schema, name: table.name })}</Text>
        <Select
          label={t("tableEntity")} variant="secondary" isDisabled={isDisabled} value={mapping.entity}
          options={DB_ENTITIES.map((e) => ({ id: e, label: t(`entity_${e}`) }))} onValueChange={(v) => set({ entity: (DB_ENTITIES.find((e) => e === v) ?? "other") as DbEntity })}
        />
        <Select label={t("colId")} description={t("colIdHint")} variant="secondary" isDisabled={isDisabled} value={mapping.idColumn || null} options={names} onValueChange={(v) => set({ idColumn: v ?? "" })} />
        <Select label={t("colTitle")} variant="secondary" isDisabled={isDisabled} value={mapping.titleColumn || NONE} options={optional} onValueChange={(v) => set({ titleColumn: !v || v === NONE ? "" : v })} />
        <Select label={t("colUpdated")} description={t("colUpdatedHint")} variant="secondary" isDisabled={isDisabled} value={mapping.updatedColumn || NONE} options={optional} onValueChange={(v) => set({ updatedColumn: !v || v === NONE ? "" : v })} />
        <CheckboxGroup
          variant="secondary" label={t("colColumns")} isDisabled={isDisabled}
          options={names.map((n) => ({ value: n.id, label: n.label }))} value={[...mapping.columns]}
          onValueChange={(v) => set({ columns: v.slice(0, MAX_COLUMNS) })}
        />
        {table.columns.length > MAX_COLUMNS ? <Text size="xs" tone="muted">{t("colCap", { max: MAX_COLUMNS })}</Text> : null}
        <div className={BUTTONS_CLASS}>
          <Button variant="outline" isPending={isPending} isDisabled={isDisabled || !mapping.idColumn} onPress={load}>{isPending ? t("previewing") : t("preview")}</Button>
        </div>
        {error ? <Alert tone="negative" title={error} /> : null}
        {rows ? (
          <div id={id} aria-live="polite">
            <Text size="xs" weight="semibold">{t("previewTitle", { table: table.name })}</Text>
            {rows.rows.length === 0 ? <Text size="xs" tone="muted">{t("previewEmpty")}</Text> : rows.rows.map((r, i) => (
              <Text key={i} size="xs" tone="muted">{rows.columns.map((c, j) => `${c}: ${r[j] ?? ""}`).join(" · ")}</Text>
            ))}
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  )
}
