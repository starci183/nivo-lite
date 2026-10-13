"use client"

import { useState, useTransition } from "react"
import { Alert, Button, CheckboxGroup, Select, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectorDatabase } from "@/i18n/dict/connectorDatabase"
import { DB_ENTITIES, DB_MAX_COLUMNS, dbTableKey, useDatabaseCommands } from "@/hooks/database-wizard"
import type { DbPreviewRows, DbTableInfo, DbTableMapping, DbTarget } from "@/modules/types"
import { BUTTONS_CLASS, SCREEN_FIELDS_CLASS } from "../../classNames"

const NONE = "__none"

/** Props for {@link TableMapper}. */
export type TableMapperProps = {
    readonly table: DbTableInfo
    readonly mapping: DbTableMapping
    readonly onChange: (next: DbTableMapping) => void
    readonly connectionId?: string
    readonly target: DbTarget
    readonly isDisabled?: boolean
}

/** One picked table: what its rows are, the id / title / updated-at columns, the columns to bring, and a 5-row preview. */
export const TableMapper = ({ table, mapping, onChange, connectionId, target, isDisabled }: TableMapperProps) => {
    const t = useT(connectorDatabase)
    const commands = useDatabaseCommands()
    const [rows, setRows] = useState<DbPreviewRows | null>(null)
    const [error, setError] = useState("")
    const [isPending, startTransition] = useTransition()
    const names = table.columns.map((c) => ({ id: c.name, label: `${c.name} (${c.type})` }))
    const optional = [{ id: NONE, label: t("colNone") }, ...names]
    const set = (patch: Partial<DbTableMapping>) => onChange({ ...mapping, ...patch })
    const id = `db-${dbTableKey({ schema: table.schema, name: table.name }).replace(/\W/g, "-")}`

    const load = () => {
        setError("")
        startTransition(async () => {
            const r = await commands.preview(connectionId, target, mapping)
            if (r.kind === "ok") setRows(r.value)
            else {
                setRows(null)
                setError(r.message)
            }
        })
    }

    return (
        <SurfaceCard depth="nested">
            <div className={SCREEN_FIELDS_CLASS}>
                <Text size="sm" weight="semibold">
                    {dbTableKey({ schema: table.schema, name: table.name })}
                </Text>
                <Select
                    label={t("tableEntity")}
                    variant="secondary"
                    isDisabled={isDisabled}
                    value={mapping.entity}
                    options={DB_ENTITIES.map((e) => ({ id: e, label: t(`entity_${e}`) }))}
                    onValueChange={(v) => set({ entity: DB_ENTITIES.find((e) => e === v) ?? "other" })}
                />
                <Select
                    label={t("colId")}
                    description={t("colIdHint")}
                    variant="secondary"
                    isDisabled={isDisabled}
                    value={mapping.idColumn || null}
                    options={names}
                    onValueChange={(v) => set({ idColumn: v ?? "" })}
                />
                <Select
                    label={t("colTitle")}
                    variant="secondary"
                    isDisabled={isDisabled}
                    value={mapping.titleColumn || NONE}
                    options={optional}
                    onValueChange={(v) => set({ titleColumn: !v || v === NONE ? "" : v })}
                />
                <Select
                    label={t("colUpdated")}
                    description={t("colUpdatedHint")}
                    variant="secondary"
                    isDisabled={isDisabled}
                    value={mapping.updatedColumn || NONE}
                    options={optional}
                    onValueChange={(v) => set({ updatedColumn: !v || v === NONE ? "" : v })}
                />
                <CheckboxGroup
                    variant="secondary"
                    label={t("colColumns")}
                    isDisabled={isDisabled}
                    options={names.map((n) => ({ value: n.id, label: n.label }))}
                    value={[...mapping.columns]}
                    onValueChange={(v) => set({ columns: v.slice(0, DB_MAX_COLUMNS) })}
                />
                {table.columns.length > DB_MAX_COLUMNS ? (
                    <Text size="xs" tone="muted">
                        {t("colCap", { max: DB_MAX_COLUMNS })}
                    </Text>
                ) : null}
                <div className={BUTTONS_CLASS}>
                    <Button
                        variant="outline"
                        isPending={isPending}
                        isDisabled={isDisabled || !mapping.idColumn}
                        onPress={load}
                    >
                        {isPending ? t("previewing") : t("preview")}
                    </Button>
                </div>
                {error ? <Alert tone="negative" title={error} /> : null}
                {rows ? (
                    <div id={id} aria-live="polite">
                        <Text size="xs" weight="semibold">
                            {t("previewTitle", { table: table.name })}
                        </Text>
                        {rows.rows.length === 0 ? (
                            <Text size="xs" tone="muted">
                                {t("previewEmpty")}
                            </Text>
                        ) : (
                            rows.rows.map((r, i) => (
                                <Text key={i} size="xs" tone="muted">
                                    {rows.columns.map((c, j) => `${c}: ${r[j] ?? ""}`).join(" · ")}
                                </Text>
                            ))
                        )}
                    </div>
                ) : null}
            </div>
        </SurfaceCard>
    )
}
