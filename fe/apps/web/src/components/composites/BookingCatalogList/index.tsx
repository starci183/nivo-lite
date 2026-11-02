import { EmptyNotice, Section, type ListRowData } from "@starci/grammar/common"

/** What the list of a setup region draws and reports. */
type BookingCatalogListProps = {
    readonly isLoading: boolean
    readonly label: string
    readonly emptyText: string
    readonly rows: ReadonlyArray<{ readonly id: string; readonly title: string; readonly detail: string }>
    readonly editLabel?: string
    readonly removeLabel: string
    readonly isPending: boolean
    readonly onEdit: (id: string) => void
    readonly onRemove: (id: string) => void
}

/** The rows of a setup region with their edit action and removal menu. */
export const BookingCatalogList = (props: BookingCatalogListProps) => (
    <Section
        kind="list"
        title={props.label}
        isLoading={props.isLoading}
        empty={<EmptyNotice message={props.emptyText} />}
        items={props.rows.map((row): ListRowData => ({
            id: row.id,
            title: row.title,
            description: row.detail,
            ...(props.editLabel === undefined
                ? {}
                : {
                      action: {
                          label: props.editLabel,
                          isDisabled: props.isPending,
                          press: () => props.onEdit(row.id),
                      },
                  }),
            menu: {
                label: `${props.removeLabel} ${row.title}`,
                entries: [
                    {
                        id: "remove",
                        label: props.removeLabel,
                        tone: "danger",
                        isDisabled: props.isPending,
                        onAction: () => props.onRemove(row.id),
                    },
                ],
            },
        }))}
    />
)
