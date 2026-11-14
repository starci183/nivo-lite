import { Grid, Alert, DataTable, Select, Text } from "@starci/grammar/common"

/** The `isLoading` prop, spread only when the caller states it (an absent flag stays absent). */
const loadingOf = (isLoading: boolean | undefined) => (isLoading === undefined ? {} : { isLoading })

/** One option of a select. */
interface CsvImportOption {
    readonly id: string
    readonly label: string
}

/** The mapping columns a select may change. */
export type CsvMapColumn = "idColumn" | "titleColumn" | "dateColumn"

/** What the mapping step draws (its data, without the actions). */
export interface CsvImportMapView {
    /** The missing-columns warning; null when every saved column is there. */
    readonly missing: string | null
    readonly intro: string
    /** The sheet select of a workbook with several sheets; null otherwise. */
    readonly sheet: { readonly value: string; readonly options: ReadonlyArray<CsvImportOption> } | null
    readonly idOptions: ReadonlyArray<CsvImportOption>
    readonly optionalOptions: ReadonlyArray<CsvImportOption>
    readonly values: Readonly<Record<CsvMapColumn, string>>
    /** The columns read automatically; null when there are none. */
    readonly kinds: string | null
    readonly headers: ReadonlyArray<string>
    readonly sample: ReadonlyArray<ReadonlyArray<string>>
    readonly text: Readonly<
        Record<"sheetLabel" | "mapId" | "mapTitle" | "mapDate" | "mapIdHint" | "previewLabel" | "previewEmpty", string>
    >
}

/** What the mapping step draws and reports. */
interface CsvImportMapProps extends CsvImportMapView {
    readonly isLoading?: boolean

    readonly isDisabled: boolean
    readonly on: {
        readonly sheet: (sheet: string) => void
        readonly column: (column: CsvMapColumn, value: string | null) => void
    }
}

/** The mapping step: which column is the id, the title and the date, what is read automatically, and the first rows. */
export const CsvImportMap = (props: CsvImportMapProps) => (
    <>
        {props.missing === null ? null : (
            <Alert
                {...loadingOf(props.isLoading)}
                tone="cautionary"
                title={props.missing}
            />
        )}
        <Text size="sm" tone="muted">
            {props.intro}
        </Text>
        {props.sheet === null ? null : (
            <Select
                {...loadingOf(props.isLoading)}
                label={props.text.sheetLabel}
                isDisabled={props.isDisabled}
                value={props.sheet.value}
                options={[...props.sheet.options]}
                onValueChange={(value) => {
                    if (value) props.on.sheet(value)
                }}
            />
        )}
        <Grid kind="form" columns={2}>
            {csvColumnsOf(props).map((column) => (
                <Select
                    key={column.name}
                    {...loadingOf(props.isLoading)}
                    label={column.label}
                    isDisabled={props.isDisabled}
                    value={props.values[column.name]}
                    options={column.options}
                    onValueChange={(value) => props.on.column(column.name, value)}
                />
            ))}
        </Grid>
        <Text size="xs" tone="muted">
            {props.text.mapIdHint}
        </Text>
        {props.kinds === null ? null : (
            <Text {...loadingOf(props.isLoading)} size="xs" tone="muted">
                {props.kinds}
            </Text>
        )}
        <DataTable
            {...loadingOf(props.isLoading)}
            label={props.text.previewLabel}
            columns={props.headers.map((header, at) => ({ id: String(at), label: header, isRowHeader: at === 0 }))}
            rows={props.sample.map((cells, at) => ({ id: String(at), cells }))}
            renderCell={(row, column) => row.cells[Number(column)] ?? ""}
            maxBlockSize="20rem"
            emptyContent={
                <Text size="sm" tone="muted">
                    {props.text.previewEmpty}
                </Text>
            }
        />
    </>
)

interface CsvColumnChoice {
    readonly name: CsvMapColumn
    readonly label: string
    readonly options: ReadonlyArray<CsvImportOption>
}
/** Resolves the three distinct mapping choices while the same native picker draws each one. */
const csvColumnsOf = (props: CsvImportMapProps): ReadonlyArray<CsvColumnChoice> => [
    { name: "idColumn", label: props.text.mapId, options: props.idOptions },
    { name: "titleColumn", label: props.text.mapTitle, options: props.optionalOptions },
    { name: "dateColumn", label: props.text.mapDate, options: props.optionalOptions },
]
