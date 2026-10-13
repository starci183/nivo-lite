import { Button, List, ListItem, Text } from "@starci/grammar/common"
import { ACTIONS_CLASS, MAIN_CLASS, ROW_CLASS } from "./classNames"

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
                <ListItem key={row.id} className={ROW_CLASS}>
                    <div className={MAIN_CLASS}>
                        <Text weight="semibold">{row.title}</Text>
                        <Text size="sm" tone="muted">
                            {row.detail}
                        </Text>
                    </div>
                    <div className={ACTIONS_CLASS}>
                        {props.editLabel === undefined ? null : (
                            <Button
                                size="sm"
                                variant="outline"
                                isDisabled={props.isPending}
                                onPress={() => props.onEdit(row.id)}
                            >
                                {props.editLabel}
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="danger-soft"
                            isDisabled={props.isPending}
                            onPress={() => props.onRemove(row.id)}
                        >
                            {props.removeLabel}
                        </Button>
                    </div>
                </ListItem>
            ))}
        </List>
    )
