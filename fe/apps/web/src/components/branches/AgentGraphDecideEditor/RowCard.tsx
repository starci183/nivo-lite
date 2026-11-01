import { Alert, Button, Cluster, SegmentedControl, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { AskFields } from "./AskFields"
import { TermRow } from "./TermRow"
import type { RowCardProps, RowProps } from "./rowProps"

/** The keys that move or drop a row. */
const RowActions = (props: RowProps) => {
    const { row, view } = props
    return (
        <Cluster gap="inline">
            {row.canMoveUp ? (
                <Button
                    intent="neutral"
                    size="sm"
                    isSkeleton={props.isSkeleton}
                    onPress={() => props.onChange({ kind: "moveRow", row: row.index, delta: -1 })}
                >
                    {view.labels.moveUp}
                </Button>
            ) : null}
            {row.canMoveDown ? (
                <Button
                    intent="neutral"
                    size="sm"
                    isSkeleton={props.isSkeleton}
                    onPress={() => props.onChange({ kind: "moveRow", row: row.index, delta: 1 })}
                >
                    {view.labels.moveDown}
                </Button>
            ) : null}
            {row.canRemove ? (
                <Button
                    intent="destructive"
                    size="sm"
                    isSkeleton={props.isSkeleton}
                    onPress={() => props.onChange({ kind: "removeRow", row: row.index })}
                >
                    {view.labels.removeRow}
                </Button>
            ) : null}
        </Cluster>
    )
}

/** The notes under the sentence of a row: what the closing "else" is, and what a condition kept as it is means. */
const RowNotes = (props: RowProps) => {
    const { row, view } = props
    const notes = [
        ...(row.isElse ? [view.labels.elseNote] : []),
        ...(row.isLocked ? [view.labels.lockedNote] : []),
        ...(row.terms.length > 1 ? [view.labels.allTerms] : []),
    ]
    return notes.map((note) => (
        <Text key={note} size="sm" tone="muted" isSkeleton={props.isSkeleton}>
            {note}
        </Text>
    ))
}

/** What a closing "else" may do: ask or stop, never run alone. */
const thenOptionsOf = (props: RowProps) =>
    props.view.thenOptions.filter((option) => !props.row.isElse || option.value !== "auto")

/** One branch as a card: when it applies, what happens, who is asked, and what is wrong with it. */
export const RowCard = (props: RowCardProps) => {
    const { row, view } = props
    return (
        <SurfaceCard label={row.title} headingLevel={3}>
            <Stack gap="section">
                <Text size="sm" tone="muted" isSkeleton={props.isSkeleton}>
                    {row.sentence}
                </Text>
                <RowNotes {...props} />
                {row.terms.map((term, at) => (
                    <TermRow key={term.id} {...props} term={term} at={at} />
                ))}
                {row.canAddTerm ? (
                    <Cluster gap="inline">
                        <Button
                            intent="alternative"
                            size="sm"
                            isSkeleton={props.isSkeleton}
                            onPress={() => props.onChange({ kind: "addTerm", row: row.index })}
                        >
                            {view.labels.addTerm}
                        </Button>
                    </Cluster>
                ) : null}
                <SegmentedControl
                    label={view.labels.then}
                    width="fill"
                    options={thenOptionsOf(props)}
                    value={row.then}
                    isSkeleton={props.isSkeleton}
                    onValueChange={(value) => props.onChange({ kind: "setRow", row: row.index, field: "then", value })}
                />
                {row.then === "ask" ? <AskFields {...props} /> : null}
                {row.problems.map((problem) => (
                    <Alert key={problem} title={problem} tone="cautionary" appearance="soft" />
                ))}
                <RowActions {...props} />
            </Stack>
        </SurfaceCard>
    )
}
