import { Badge, Button, EmptyNotice, ListRow, Meter, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME, DETAIL_CLASS_NAME, LINE_CLASS_NAME, TEXT_CLASS_NAME } from "./classNames"

/** One link or button at the end of a row. */
export interface RowActionView {
    readonly id: string
    readonly label: string
    /** Where a link goes; a button when absent. */
    readonly href?: string
    readonly intent?: "commit" | "alternative" | "neutral" | "destructive"
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
    readonly progress?: { readonly label: string; readonly value: number } | undefined
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

interface ItemButtonProps {
    readonly item: RowActionView
    readonly isPending: boolean
}

/** One button of a row: a destructive command opens its confirmation first, every other one is a plain item action. */
const ItemButton = (props: ItemButtonProps) =>
    props.item.intent === "destructive" ? (
        <Button
            intent="destructive"
            step="entry"
            isPending={props.isPending}
            {...(props.item.onPress !== undefined && { onPress: props.item.onPress })}
        >
            {props.item.label}
        </Button>
    ) : (
        <Button
            intent={props.item.intent ?? "neutral"}
            isPending={props.isPending}
            {...(props.item.onPress !== undefined && { onPress: props.item.onPress })}
        >
            {props.item.label}
        </Button>
    )

/** The links and buttons of one row or part. */
export const ActionList = (props: ActionListProps) =>
    props.items.length === 0 ? null : (
        <div className={ACTIONS_CLASS_NAME}>
            {props.items.map((item) =>
                item.href === undefined ? (
                    <ItemButton key={item.id} item={item} isPending={props.isPending} />
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
    <ListRow
        title={
            props.row.href === undefined ? (
                props.row.title
            ) : (
                <TextAction href={props.row.href}>{props.row.title}</TextAction>
            )
        }
        description={(props.row.lines ?? []).length === 0 ? null : (props.row.lines ?? []).join(" · ")}
        badges={
            <>
                {(props.row.badges ?? []).map((badge) => (
                    <Badge key={badge.label} tone={badge.tone}>
                        {badge.label}
                    </Badge>
                ))}
            </>
        }
        actions={<ActionList items={props.row.actions ?? []} isPending={props.isPending} />}
    >
        {props.row.progress === undefined && (props.row.parts ?? []).length === 0 ? null : (
            <div className={DETAIL_CLASS_NAME}>
                {props.row.progress === undefined ? null : (
                    <Meter label={props.row.progress.label} value={props.row.progress.value} isLabelHidden />
                )}
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
            </div>
        )}
    </ListRow>
)

/** The list itself: a card of rows, or the notice that shows while there are none. */
export const Rows = (props: RowsProps) => (
    <SurfaceListCard
        ariaLabel={props.label}
        isLoading={props.isLoading}
        empty={
            <EmptyNotice
                message={props.emptyTitle}
                {...(props.emptyBody === undefined ? {} : { description: props.emptyBody })}
            />
        }
    >
        {props.rows.map((row) => (
            <Row key={row.id} row={row} isPending={props.isPending} />
        ))}
    </SurfaceListCard>
)
