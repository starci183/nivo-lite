import { Alert, Button, CheckboxGroup, Select, SurfaceCard, Text } from "@starci/grammar/common"
import { databaseTableMapperClassNames as classNames } from "./classNames"

/** One option of a column or entity select. */
interface DatabaseSelectOption {
    readonly id: string
    readonly label: string
}

/** What one picked table draws: its mapping, the column choices and the preview. */
export interface DatabaseTableMapperProps {
    readonly props: {
        /** Element id of the preview region. */
        readonly id: string
        readonly title: string
        readonly entity: string
        readonly entities: ReadonlyArray<DatabaseSelectOption>
        readonly idColumn: string | null
        readonly titleColumn: string
        readonly updatedColumn: string
        readonly columns: ReadonlyArray<string>
        /** Every column of the table. */
        readonly names: ReadonlyArray<DatabaseSelectOption>
        /** The "no column" choice shown first in the optional pickers. */
        readonly noneColumn: DatabaseSelectOption
        /** The note that only the first columns are brought; null when the table is small enough. */
        readonly cap: string | null
        readonly isDisabled: boolean
        readonly isPreviewing: boolean
        readonly canPreview: boolean
        readonly error: string | null
        /** The preview lines once loaded; null before. */
        readonly lines: ReadonlyArray<DatabasePreviewLine> | null
        readonly previewTitle: string
        readonly text: Readonly<
            Record<
                | "entity"
                | "id"
                | "idHint"
                | "titleColumn"
                | "updated"
                | "updatedHint"
                | "columns"
                | "preview"
                | "previewEmpty",
                string
            >
        >
    }
    readonly on: {
        readonly entity: (value: string | null) => void
        readonly id: (value: string | null) => void
        readonly title: (value: string | null) => void
        readonly updated: (value: string | null) => void
        readonly columns: (value: ReadonlyArray<string>) => void
        readonly preview: () => void
    }
}

/** One preview row as a line of text, with a stable id. */
interface DatabasePreviewLine {
    readonly id: string
    readonly text: string
}

/** What the preview region draws. */
interface DatabaseTablePreviewProps {
    readonly id: string
    readonly title: string
    /** The sentence shown when the table has no rows. */
    readonly empty: string
    readonly lines: ReadonlyArray<DatabasePreviewLine>
}

/** One picked table: what its rows are, the id / title / updated-at columns, the columns to bring, and a 5-row preview. */
export const DatabaseTableMapper = (props: DatabaseTableMapperProps) => {
    const { props: view, on } = props
    return (
        <SurfaceCard>
            <div className={classNames.fields}>
                <Text size="sm" weight="semibold">
                    {view.title}
                </Text>
                <Select
                    label={view.text.entity}
                    isDisabled={view.isDisabled}
                    value={view.entity}
                    options={view.entities}
                    onValueChange={on.entity}
                />
                <Select
                    label={view.text.id}
                    description={view.text.idHint}
                    isDisabled={view.isDisabled}
                    value={view.idColumn}
                    options={view.names}
                    onValueChange={on.id}
                />
                <Select
                    label={view.text.titleColumn}
                    isDisabled={view.isDisabled}
                    value={view.titleColumn}
                    options={[view.noneColumn, ...view.names]}
                    onValueChange={on.title}
                />
                <Select
                    label={view.text.updated}
                    description={view.text.updatedHint}
                    isDisabled={view.isDisabled}
                    value={view.updatedColumn}
                    options={[view.noneColumn, ...view.names]}
                    onValueChange={on.updated}
                />
                <CheckboxGroup
                    label={view.text.columns}
                    isDisabled={view.isDisabled}
                    options={view.names.map((name) => ({ value: name.id, label: name.label }))}
                    value={[...view.columns]}
                    onValueChange={on.columns}
                />
                {view.cap === null ? null : (
                    <Text size="xs" tone="muted">
                        {view.cap}
                    </Text>
                )}
                <div className={classNames.buttons}>
                    <Button
                        intent="neutral"
                        isPending={view.isPreviewing}
                        isDisabled={!view.canPreview}
                        onPress={on.preview}
                    >
                        {view.text.preview}
                    </Button>
                </div>
                {view.error === null ? null : <Alert tone="negative" title={view.error} />}
                {view.lines === null ? null : (
                    <DatabaseTablePreviewView
                        id={view.id}
                        title={view.previewTitle}
                        empty={view.text.previewEmpty}
                        lines={view.lines}
                    />
                )}
            </div>
        </SurfaceCard>
    )
}

/** The first rows of the table, read out politely when they arrive. */
const DatabaseTablePreviewView = (props: DatabaseTablePreviewProps) => (
    <div id={props.id} aria-live="polite">
        <Text size="xs" weight="semibold">
            {props.title}
        </Text>
        {props.lines.length === 0 ? (
            <Text size="xs" tone="muted">
                {props.empty}
            </Text>
        ) : null}
        {props.lines.map((line) => (
            <Text key={line.id} size="xs" tone="muted">
                {line.text}
            </Text>
        ))}
    </div>
)
