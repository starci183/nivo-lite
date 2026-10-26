import { Button, List, ListRow, Text } from "@starci/grammar/common"
import { ACTIONS_CLASS } from "./classNames"

/** What the list of a setup region draws and reports. */
type BookingCatalogListProps = {
    readonly label: string
    readonly emptyText: string
    readonly rows: ReadonlyArray<{ readonly id: string; readonly title: string; readonly detail: string }>
    readonly editLabel?: string
    readonly removeLabel: string
    readonly isPending: boolean
    readonly onEdit: (id: string) => void
    readonly onRemove: (id: string) => void
}

/** The rows of a setup region: each one says what it is and offers to edit or remove it; a line says so when there is none. */
export const BookingCatalogList = (props: BookingCatalogListProps) =>
    props.rows.length === 0 ? (
        <Text size="sm" tone="muted">
            {props.emptyText}
        </Text>
    ) : (
        <List label={props.label}>
            {props.rows.map((row) => (
                <ListRow
                    key={row.id}
                    title={row.title}
                    description={row.detail}
                    actions={
                        <div className={ACTIONS_CLASS}>
                            {props.editLabel === undefined ? null : (
                                <Button
                                    size="sm"
                                    intent="neutral"
                                    isDisabled={props.isPending}
                                    onPress={() => props.onEdit(row.id)}
                                >
                                    {props.editLabel}
                                </Button>
                            )}
                            <Button
                                size="sm"
                                intent="destructive"
                                step="entry"
                                isDisabled={props.isPending}
                                onPress={() => props.onRemove(row.id)}
                            >
                                {props.removeLabel}
                            </Button>
                        </div>
                    }
                />
            ))}
        </List>
    )
