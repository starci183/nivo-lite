import { Badge, Cluster, Code, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { ProviderDocEntryView, ProviderDocMemberView, ProviderDocWords } from "@/modules/types"

/** The muted tone, only on an entry that cannot be used. */
const toneOf = (muted: boolean) => (muted ? { tone: "muted" as const } : {})

/** The note of an entry, only when it has one. */
const noteOf = (note: string | null) => (note === null ? {} : { note })

/** Fake entries of the same shape: the skeleton of a docs tab reuses the ready tree (two entries, two members each). */
export const PROVIDER_DOC_PLACEHOLDER: ReadonlyArray<ProviderDocEntryView> = ["a", "b"].map((id) => ({
    id,
    name: "-",
    kindLabel: "-",
    summary: "-",
    fact: null,
    groups: [
        {
            id: "parameters",
            label: "-",
            rows: ["x", "y"].map((row) => ({ id: row, name: "-", type: "-", choices: [], meaning: "-" })),
        },
    ],
    note: null,
    marks: [],
    line: null,
    stateNote: null,
}))

/** What the entries of one docs level draw. */
interface ProviderDocListProps {
    readonly entries: ReadonlyArray<ProviderDocEntryView>
    readonly words: ProviderDocWords
    readonly isLoading: boolean
}

/** The entry a head is drawn for, and whether it is still loading. */
interface EntryHeadProps {
    readonly entry: ProviderDocEntryView
    readonly isLoading: boolean
}

/** The head of an entry: the kind chip, the mark chips (words, never colour) and the registry id as code, the one short fact at the end, the method and path, the summary and the reason it cannot be used under them. */
const EntryHead = (props: EntryHeadProps) => {
    const muted = props.entry.stateNote !== null
    return (
        <Stack gap="identity">
            <Cluster gap="inline" justify="between" wrap>
                <Cluster gap="identity" wrap>
                    <Badge tone={muted ? "muted" : "neutral"} isLoading={props.isLoading}>
                        {props.entry.kindLabel}
                    </Badge>
                    <Code isLoading={props.isLoading}>{props.entry.name}</Code>
                    {props.entry.marks.map((mark) => (
                        <Badge key={mark} tone="neutral" isLoading={props.isLoading}>
                            {mark}
                        </Badge>
                    ))}
                </Cluster>
                {props.entry.fact === null ? null : (
                    <Text size="xs" tone="muted" isLoading={props.isLoading}>
                        {props.entry.fact}
                    </Text>
                )}
            </Cluster>
            {props.entry.line === null ? null : (
                <Cluster gap="inline">
                    <Code isLoading={props.isLoading}>{props.entry.line}</Code>
                </Cluster>
            )}
            {props.entry.summary === null ? null : (
                <Text size="sm" {...toneOf(muted)} isLoading={props.isLoading}>
                    {props.entry.summary}
                </Text>
            )}
            {props.entry.stateNote === null ? null : (
                <Text size="xs" tone="muted" isLoading={props.isLoading}>
                    {props.entry.stateNote}
                </Text>
            )}
        </Stack>
    )
}

/** The Type cell: a closed choice list is the identifiers the API sends, each drawn as code; any other type is its word. */
const typeCellOf = (row: ProviderDocMemberView) =>
    row.choices.length === 0 ? (
        row.type
    ) : (
        <Cluster gap="identity" wrap>
            {row.choices.map((choice) => (
                <Code key={choice}>{choice}</Code>
            ))}
        </Cluster>
    )

/** The entry, its words and whether it is still loading. */
interface EntryTableProps {
    readonly entry: ProviderDocEntryView
    readonly words: ProviderDocWords
    readonly isLoading: boolean
}

/** One entry that declares members: its head and one table of its member groups. */
const EntryTable = (props: EntryTableProps) => {
    const { entry } = props
    return (
        <SurfaceCard
            kind="table"
            ariaLabel={entry.name}
            isLoading={props.isLoading}
            headers={[{ kind: "custom", children: <EntryHead entry={entry} isLoading={props.isLoading} /> }]}
            columns={[
                { id: "name", label: props.words.columnName, width: "fit" },
                { id: "type", label: props.words.columnType, width: "fit" },
                { id: "meaning", label: props.words.columnMeaning, width: "fill" },
            ]}
            phone="list"
            empty={
                <Text size="sm" tone="muted">
                    {props.words.membersEmpty}
                </Text>
            }
            groups={entry.groups.map((group) => ({
                id: group.id,
                label: group.label,
                rows: group.rows.map((row) => ({
                    id: row.id,
                    cells: { name: <Code>{row.name}</Code>, type: typeCellOf(row), meaning: row.meaning },
                })),
            }))}
            {...noteOf(entry.note)}
        />
    )
}

/**
 * The documented entries of one level of a provider (a read, a tool or a trigger each), one card per entry: the head zone carries
 * the kind chip, the id, the fact and the summary; the body is Grammar's table with one column header (name, type, meaning) and
 * one heading row per member group (parameters, returns, event data); an entry that declares no member is its head alone, as the
 * drawing's `nivo.tool.connection.status.get`; a trigger's batching and recovery line is the card's note.
 */
export const ProviderDocList = (props: ProviderDocListProps) => (
    <Stack gap="section">
        {props.entries.map((entry) =>
            entry.groups.length === 0 ? (
                <SurfaceCard key={entry.id} ariaLabel={entry.name} isLoading={props.isLoading} {...noteOf(entry.note)}>
                    <EntryHead entry={entry} isLoading={props.isLoading} />
                </SurfaceCard>
            ) : (
                <EntryTable key={entry.id} entry={entry} words={props.words} isLoading={props.isLoading} />
            ),
        )}
    </Stack>
)
