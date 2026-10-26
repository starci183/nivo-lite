import { Button, Fieldset, HorizontalScrollRegion, Input, Text } from "@starci/grammar/common"
import { csvImportGridClassNames as classNames } from "./classNames"

/** One column of the grid as drawn: its name, the label of its name field and the label of its cells. */
interface CsvImportGridColumn {
    readonly id: string
    readonly name: string
    readonly label: string
    readonly cellLabel: string
}

/** What the typed grid draws (its data, without the actions). */
export interface CsvImportGridView {
    readonly columns: ReadonlyArray<CsvImportGridColumn>
    readonly rows: ReadonlyArray<{ readonly id: string; readonly cells: ReadonlyArray<string> }>
    /** True when the grid holds the most rows it may. */
    readonly isFull: boolean
    readonly text: Readonly<Record<"title" | "addRow" | "addColumn" | "remove" | "rows" | "tooBig", string>>
}

/** What the typed grid draws and reports. */
interface CsvImportGridProps extends CsvImportGridView {
    readonly isDisabled: boolean
    readonly on: {
        readonly rename: (columnId: string, value: string) => void
        readonly cell: (rowId: string, columnId: string, value: string) => void
        readonly addRow: () => void
        readonly removeRow: (rowId: string) => void
        readonly addColumn: () => void
    }
}

/** A small editable table: column names on top, one row of inputs per record, add or remove rows and add columns. */
export const CsvImportGrid = (props: CsvImportGridProps) => (
    <div className={classNames.root}>
        <Fieldset legend={props.text.title} isLegendHidden>
            <HorizontalScrollRegion overflow="needed" aria-label={props.text.title}>
                <div className={classNames.row}>
                    {props.columns.map((column) => (
                        <div key={column.id} className={classNames.cell}>
                            <Input
                                id={`csv-h-${column.id}`}
                                name={`csv-h-${column.id}`}
                                label={column.label}
                                value={column.name}
                                isDisabled={props.isDisabled}
                                onValueChange={(value) => props.on.rename(column.id, value)}
                            />
                        </div>
                    ))}
                </div>
                {props.rows.map((row) => (
                    <div key={row.id} className={classNames.row}>
                        {props.columns.map((column, at) => (
                            <div key={column.id} className={classNames.cell}>
                                <Input
                                    id={`csv-${row.id}-${column.id}`}
                                    name={`csv-${row.id}-${column.id}`}
                                    label={column.cellLabel}
                                    value={row.cells[at] ?? ""}
                                    isDisabled={props.isDisabled}
                                    onValueChange={(value) => props.on.cell(row.id, column.id, value)}
                                />
                            </div>
                        ))}
                        <Button
                            intent="destructive"
                            step="entry"
                            isDisabled={props.isDisabled}
                            onPress={() => props.on.removeRow(row.id)}
                        >
                            {props.text.remove}
                        </Button>
                    </div>
                ))}
            </HorizontalScrollRegion>
        </Fieldset>
        <div className={classNames.actions}>
            <Button intent="neutral" isDisabled={props.isDisabled || props.isFull} onPress={props.on.addRow}>
                {props.text.addRow}
            </Button>
            <Button intent="neutral" isDisabled={props.isDisabled} onPress={props.on.addColumn}>
                {props.text.addColumn}
            </Button>
            <Text size="xs" tone="muted">
                {props.text.rows}
            </Text>
        </div>
        {props.isFull ? (
            <Text size="xs" tone="muted">
                {props.text.tooBig}
            </Text>
        ) : null}
    </div>
)
