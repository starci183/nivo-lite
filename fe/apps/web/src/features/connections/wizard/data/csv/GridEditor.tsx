"use client"

import { cn } from "@heroui/react"
import { Button, Input, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectorCsv } from "@/i18n/dict/connectorCsv"
import { MAX_GRID_ROWS, type Grid } from "./grid"

const SCROLL_CLASS = cn("max-h-96", "overflow-auto", "rounded-lg", "border")
const ROW_CLASS = cn("flex", "items-end", "gap-2", "p-2")
const CELL_CLASS = cn("w-40", "shrink-0")
const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")

/** Props for {@link GridEditor}. */
export type GridEditorProps = {
  readonly grid: Grid
  readonly onChange: (grid: Grid) => void
  readonly isDisabled?: boolean
}

/** A small editable table: column names on top, one row of inputs per record, add or remove rows and columns. */
export const GridEditor = ({ grid, onChange, isDisabled }: GridEditorProps) => {
  const t = useT(connectorCsv)
  const setHeader = (c: number, v: string) => onChange({ ...grid, headers: grid.headers.map((h, i) => (i === c ? v : h)) })
  const setCell = (r: number, c: number, v: string) =>
    onChange({ ...grid, rows: grid.rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) })
  const addRow = () => onChange({ ...grid, rows: [...grid.rows, grid.headers.map(() => "")] })
  const removeRow = (r: number) => onChange({ ...grid, rows: grid.rows.filter((_, i) => i !== r) })
  const addColumn = () => onChange({ headers: [...grid.headers, ""], rows: grid.rows.map((row) => [...row, ""]) })
  const colName = (c: number) => grid.headers[c].trim() || t("gridHeader", { n: c + 1 })

  return (
    <div className={cn("flex", "min-w-0", "flex-col", "gap-2")}>
      <div className={SCROLL_CLASS} role="group" aria-label={t("gridTitle")}>
        <div className={ROW_CLASS}>
          {grid.headers.map((h, c) => (
            <div key={c} className={CELL_CLASS}>
              <Input id={`csv-h-${c}`} name={`csv-h-${c}`} variant="secondary" label={t("gridHeader", { n: c + 1 })} value={h} isDisabled={isDisabled} onValueChange={(v) => setHeader(c, v)} />
            </div>
          ))}
        </div>
        {grid.rows.map((row, r) => (
          <div key={r} className={ROW_CLASS}>
            {row.map((v, c) => (
              <div key={c} className={CELL_CLASS}>
                <Input id={`csv-${r}-${c}`} name={`csv-${r}-${c}`} variant="secondary" label={colName(c)} value={v} isDisabled={isDisabled} onValueChange={(x) => setCell(r, c, x)} />
              </div>
            ))}
            <Button variant="ghost" isDisabled={isDisabled} onPress={() => removeRow(r)}>{t("gridRemove")}</Button>
          </div>
        ))}
      </div>
      <div className={ACTIONS_CLASS}>
        <Button variant="outline" isDisabled={isDisabled || grid.rows.length >= MAX_GRID_ROWS} onPress={addRow}>{t("gridAddRow")}</Button>
        <Button variant="outline" isDisabled={isDisabled} onPress={addColumn}>{t("gridAddColumn")}</Button>
        <Text size="xs" tone="muted">{t("gridRows", { n: grid.rows.length })}</Text>
      </div>
      {grid.rows.length >= MAX_GRID_ROWS ? <Text size="xs" tone="muted">{t("gridTooBig")}</Text> : null}
    </div>
  )
}
