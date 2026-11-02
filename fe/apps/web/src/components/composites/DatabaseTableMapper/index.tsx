import {
    Alert,
    Button,
    CheckboxGroup,
    EmptyNotice,
    Section,
    Select,
    Text,
    Stack,
    Cluster,
} from "@starci/grammar/common"

/** One option of a column or entity select. */
interface DatabaseSelectOption {
    readonly id: string
    readonly label: string
}

/** What one picked table draws: its mapping, the column choices and the preview. */
export interface DatabaseTableMapperProps {
    readonly props: {
        readonly isLoading?: boolean

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
    readonly isLoading?: boolean
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
        <Section
            {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
            title={view.title}
            headingLevel={4}
        >
            <Stack gap="section">
                <DatabaseMappingColumns {...props} />
                <CheckboxGroup
                    {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
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
                <Cluster gap="inline">
                    <Button
                        {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
                        intent="neutral"
                        isPending={view.isPreviewing}
                        isDisabled={!view.canPreview}
                        onPress={on.preview}
                    >
                        {view.text.preview}
                    </Button>
                </Cluster>
                {view.error === null ? null : (
                    <Alert
                        {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
                        tone="negative"
                        title={view.error}
                    />
                )}
                {view.lines === null ? null : (
                    <DatabaseTablePreviewView
                        {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
                        id={view.id}
                        title={view.previewTitle}
                        empty={view.text.previewEmpty}
                        lines={view.lines}
                    />
                )}
            </Stack>
        </Section>
    )
}

/** The first rows of the table, read out politely when they arrive. */
const DatabaseTablePreviewView = (props: DatabaseTablePreviewProps) => (
    <div id={props.id} aria-live="polite">
        <Section
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            kind="list"
            title={props.title}
            headingLevel={3}
            items={props.lines.map((line) => ({ id: line.id, title: line.text }))}
            empty={<EmptyNotice message={props.empty} />}
        />
    </div>
)

/** Entity and identity columns remain one mapping responsibility above the preview. */
const DatabaseMappingColumns = (props: DatabaseTableMapperProps) => {
    const { props: view, on } = props
    return (
        <>
            {" "}
            <Select
                {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
                label={view.text.entity}
                isDisabled={view.isDisabled}
                value={view.entity}
                options={view.entities}
                onValueChange={on.entity}
            />
            <Select
                {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
                label={view.text.id}
                description={view.text.idHint}
                isDisabled={view.isDisabled}
                value={view.idColumn}
                options={view.names}
                onValueChange={on.id}
            />
            <Select
                {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
                label={view.text.titleColumn}
                isDisabled={view.isDisabled}
                value={view.titleColumn}
                options={[view.noneColumn, ...view.names]}
                onValueChange={on.title}
            />
            <Select
                {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
                label={view.text.updated}
                description={view.text.updatedHint}
                isDisabled={view.isDisabled}
                value={view.updatedColumn}
                options={[view.noneColumn, ...view.names]}
                onValueChange={on.updated}
            />
        </>
    )
}
