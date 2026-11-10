import { Button, Cluster, Popover, Select, Stack, SurfaceCard, Text } from "@starci/grammar/common"

/** One stretch of duty: "HH:mm" at both ends. */
interface ListRange {
    readonly start: string
    readonly end: string
}

/** A time a range end may take. */
interface ListTime {
    readonly id: string
    readonly label: string
}

/** One row: the days it stands for (Monday is 0) and their ranges. */
interface ListRow {
    readonly id: string
    readonly days: ReadonlyArray<number>
    readonly ranges: ReadonlyArray<ListRange>
    readonly canAdd: boolean
}

/** The words of the list. */
interface ListWords {
    readonly label: string
    /** The seven long day names, Monday first. */
    readonly longDays: ReadonlyArray<string>
    readonly closedLabel: string
    readonly addLabel: string
    readonly removeLabel: string
    readonly splitLabel: string
    readonly fromLabel: string
    readonly toLabel: string
}

/** The commands of the list; each applies to every day the row stands for. */
interface WorkingHoursListCommands {
    readonly add: (days: ReadonlyArray<number>) => void
    readonly remove: (days: ReadonlyArray<number>, at: number) => void
    readonly edit: (days: ReadonlyArray<number>, at: number, side: "start" | "end", clock: string) => void
    readonly split: (days: ReadonlyArray<number>) => void
}

/** The words, the rows and the commands of the working hours list. */
export interface WorkingHoursListProps {
    readonly words: ListWords
    readonly rows: ReadonlyArray<ListRow>
    readonly startOptions: ReadonlyArray<ListTime>
    readonly endOptions: ReadonlyArray<ListTime>
    readonly isDisabled: boolean
    readonly on: WorkingHoursListCommands
}

const keyOf = (days: ReadonlyArray<number>, names: ReadonlyArray<string>): string => {
    const first = names[days[0] ?? 0] ?? ""
    const last = names[days[days.length - 1] ?? 0] ?? ""
    return days.length > 1 ? `${first} - ${last}` : first
}

const rangeText = (range: ListRange): string => `${range.start} - ${range.end}`

/** The part of the list one range editor needs. */
interface EditorProps {
    readonly row: ListRow
    readonly at: number
    readonly words: ListWords
    readonly startOptions: ReadonlyArray<ListTime>
    readonly endOptions: ReadonlyArray<ListTime>
    readonly isDisabled: boolean
    readonly on: WorkingHoursListCommands
}

/** The two time choices of a range, its remove command and (for a merged row) the command that splits a day out. */
const RangeEditor = (props: EditorProps) => {
    const range = props.row.ranges[props.at]
    if (range === undefined) return null
    return (
        <Stack gap="inline">
            <Select
                label={props.words.fromLabel}
                options={props.startOptions}
                value={range.start}
                isDisabled={props.isDisabled}
                onValueChange={(value) => value !== null && props.on.edit(props.row.days, props.at, "start", value)}
            />
            <Select
                label={props.words.toLabel}
                options={props.endOptions}
                value={range.end}
                isDisabled={props.isDisabled}
                onValueChange={(value) => value !== null && props.on.edit(props.row.days, props.at, "end", value)}
            />
            <Cluster gap="inline">
                <Button
                    intent="neutral"
                    size="sm"
                    isDisabled={props.isDisabled}
                    onPress={() => props.on.remove(props.row.days, props.at)}
                >
                    {props.words.removeLabel}
                </Button>
                {props.row.days.length > 1 ? (
                    <Button
                        intent="neutral"
                        size="sm"
                        isDisabled={props.isDisabled}
                        onPress={() => props.on.split(props.row.days)}
                    >
                        {props.words.splitLabel}
                    </Button>
                ) : null}
            </Cluster>
        </Stack>
    )
}

/** The value of one row: its range chips and the add command at the end. */
const RowValue = (props: Omit<EditorProps, "at">) => (
    <Cluster gap="inline" justify="between" wrap={false}>
        <Cluster gap="inline">
            {props.row.ranges.length === 0 ? (
                <Text tone="muted">{props.words.closedLabel}</Text>
            ) : (
                props.row.ranges.map((range, at) => (
                    <Popover
                        key={range.start}
                        label={`${keyOf(props.row.days, props.words.longDays)}: ${rangeText(range)}`}
                        trigger={
                            <Button intent="neutral" size="sm" isDisabled={props.isDisabled}>
                                {rangeText(range)}
                            </Button>
                        }
                    >
                        <RangeEditor {...props} at={at} />
                    </Popover>
                ))
            )}
        </Cluster>
        <Button
            intent="neutral"
            size="sm"
            isDisabled={props.isDisabled || !props.row.canAdd}
            onPress={() => props.on.add(props.row.days)}
        >
            {props.words.addLabel}
        </Button>
    </Cluster>
)

/**
 * The weekly working hours as one key-value card: a row per day, consecutive days with the same ranges merged into one row
 * (Monday - Friday), the day on the left and its ranges as small chips on the right (a day without any reads closed). Pressing a
 * range opens its two time choices with remove; a command on a merged row applies to every day of it until a day is split out.
 */
export const WorkingHoursList = (props: WorkingHoursListProps) => (
    <SurfaceCard
        kind="list"
        layout="keyValue"
        label={props.words.label}
        headingLevel={2}
        empty={<Text tone="muted">{props.words.closedLabel}</Text>}
        items={props.rows.map((row) => ({
            id: row.id,
            title: keyOf(row.days, props.words.longDays),
            value: (
                <RowValue
                    row={row}
                    words={props.words}
                    startOptions={props.startOptions}
                    endOptions={props.endOptions}
                    isDisabled={props.isDisabled}
                    on={props.on}
                />
            ),
        }))}
    />
)
