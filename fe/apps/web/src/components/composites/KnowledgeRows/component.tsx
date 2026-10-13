import { Badge, Button, EmptyNotice, ListItem, Meter, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME, BADGES_CLASS_NAME, LINE_CLASS_NAME, ROW_CLASS_NAME, TEXT_CLASS_NAME } from "./classNames"

/** One link or button at the end of a row. */
export interface RowActionView {
    readonly id: string
    readonly label: string
    /** Where a link goes; a button when absent. */
    readonly href?: string
    readonly variant?: "primary" | "outline" | "ghost"
    readonly onPress?: () => void
}

/** A small label beside a row. */
interface RowBadgeView {
    readonly label: string
    readonly tone: "neutral" | "warning" | "success" | "danger" | "accent"
}

/** One part of a row that has its own text, badges and actions, such as one waiting value of a conflict. */
export interface RowPartView {
    readonly id: string
    readonly title: string
    readonly lines?: ReadonlyArray<string>
    readonly actions?: ReadonlyArray<RowActionView>
}

/** One row of a list, already worded. */
export interface KnowledgeRowView {
    readonly id: string
    readonly title: string
    /** Muted lines under the title. */
    readonly lines?: ReadonlyArray<string>
    readonly badges?: ReadonlyArray<RowBadgeView>
    readonly actions?: ReadonlyArray<RowActionView>
    readonly parts?: ReadonlyArray<RowPartView>
    /** The reading of a worker, 0-100; nothing is drawn for it while undefined. */
    readonly progress?: { readonly label: string; readonly value: number }
    /** A link on the title. */
    readonly href?: string
}

/** What the card of rows draws. */
export interface RowsProps {
    readonly label: string
    readonly rows: ReadonlyArray<KnowledgeRowView>
    readonly isLoading: boolean
    readonly isPending: boolean
    readonly emptyTitle: string
    readonly emptyBody?: string
}

/** What the actions of a row or part draw. */
interface ActionListProps {
    readonly items: ReadonlyArray<RowActionView>
    readonly isPending: boolean
}

/** What one row draws. */
interface RowProps {
    readonly row: KnowledgeRowView
    readonly isPending: boolean
}

/** The links and buttons of one row or part. */
export const ActionList = (props: ActionListProps) =>
    props.items.length === 0 ? null : (
        <div className={ACTIONS_CLASS_NAME}>
            {props.items.map((item) =>
                item.href === undefined ? (
                    <Button
                        key={item.id}
                        variant={item.variant ?? "outline"}
                        isPending={props.isPending}
                        onPress={item.onPress}
                    >
                        {item.label}
                    </Button>
                ) : (
                    <Text key={item.id}>
                        <TextAction href={item.href}>{item.label}</TextAction>
                    </Text>
                ),
            )}
        </div>
    )

/** One row: the title with its lines, the badges, the actions and the parts that have their own. */
const Row = (props: RowProps) => (
    <ListItem className={ROW_CLASS_NAME}>
        <div className={LINE_CLASS_NAME}>
            <div className={TEXT_CLASS_NAME}>
                <Text weight="semibold" overflow="truncate">
                    {props.row.href === undefined ? (
                        props.row.title
                    ) : (
                        <TextAction href={props.row.href}>{props.row.title}</TextAction>
                    )}
                </Text>
                {(props.row.lines ?? []).map((line) => (
                    <Text key={line} size="sm" tone="muted">
                        {line}
                    </Text>
                ))}
                {props.row.progress === undefined ? null : (
                    <Meter label={props.row.progress.label} value={props.row.progress.value} isLabelHidden />
                )}
            </div>
            <div className={BADGES_CLASS_NAME}>
                {(props.row.badges ?? []).map((badge) => (
                    <Badge key={badge.label} tone={badge.tone}>
                        {badge.label}
                    </Badge>
                ))}
            </div>
            <ActionList items={props.row.actions ?? []} isPending={props.isPending} />
        </div>
        {(props.row.parts ?? []).map((part) => (
            <div key={part.id} className={LINE_CLASS_NAME}>
                <div className={TEXT_CLASS_NAME}>
                    <Text>{part.title}</Text>
                    {(part.lines ?? []).map((line) => (
                        <Text key={line} size="xs" tone="muted">
                            {line}
                        </Text>
                    ))}
                </div>
                <ActionList items={part.actions ?? []} isPending={props.isPending} />
            </div>
        ))}
    </ListItem>
)

/** The list itself: a card of rows, or the notice that shows while there are none. */
export const Rows = (props: RowsProps) => (
    <SurfaceListCard
        ariaLabel={props.label}
        isLoading={props.isLoading}
        empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
    >
        {props.rows.map((row) => (
            <Row key={row.id} row={row} isPending={props.isPending} />
        ))}
    </SurfaceListCard>
)
