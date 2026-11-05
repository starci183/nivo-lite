import { Button, EmptyNotice, ListBox, Stack, Text } from "@starci/grammar/common"
import type { ErrorData, IconSource, ListBoxItem, ListBoxSection } from "@starci/grammar/common"
import { FilterGroup } from "@/components/composites/FilterGroup"
import type { FilterGroupChoice, FilterGroupSearch } from "@/components/composites/FilterGroup"

/** What an empty list says, and the one action that invites the next step. */
interface PaneListEmpty {
    readonly message: string
    readonly description?: string
    readonly iconSource?: IconSource
    readonly actionLabel?: string
    readonly onAction?: () => void
}

/** What the list pane body draws. */
interface PaneListProps {
    /** Names the list for assistive technology. */
    readonly label: string
    /** The one muted line above the rows (the sort order and a count, for example). */
    readonly summary?: string
    readonly search?: FilterGroupSearch
    readonly choice?: FilterGroupChoice
    /** The rows, flat; or `sections` for rows grouped under captions. */
    readonly items?: ReadonlyArray<ListBoxItem>
    readonly sections?: ReadonlyArray<ListBoxSection>
    readonly selectedId: string | null
    readonly onSelect: (id: string) => void
    /** What shows when no row remains, whether the list is empty or a filter matched nothing. */
    readonly empty: PaneListEmpty
    /** The read failed: the band that takes the place of the rows, with its retry. */
    readonly error?: ErrorData
    /** The first read has no data yet: the controls and the rows draw as geometry of the ready list. */
    readonly isLoading?: boolean
    /** A muted line under the rows (how many are shown, for example). */
    readonly footer?: string
    /** Loads more rows: the neutral small command under the closing line, with the failed-load line and its retry. */
    readonly footerAction?: {
        readonly label: string
        readonly onPress: () => void
        readonly isPending?: boolean
        readonly error?: string
    }
}

/** The empty notice of a list, with its one action when it has one. */
const emptyNoticeOf = (empty: PaneListEmpty) => (
    <EmptyNotice
        message={empty.message}
        {...(empty.description === undefined ? {} : { description: empty.description })}
        {...(empty.iconSource === undefined ? {} : { iconSource: empty.iconSource })}
        {...(empty.actionLabel === undefined || empty.onAction === undefined
            ? {}
            : { actionLabel: empty.actionLabel, onAction: empty.onAction })}
    />
)

/**
 * The content of a list pane: the filter group, the summary line, the rows and a closing line, in one column that the pane
 * scrolls under its head. While the read waits, the controls and each row draw their own skeleton in the shape of the ready ones;
 * a failed read replaces the rows with the danger band and its retry; an empty list shows the notice with its one action.
 */
export const PaneList = (props: PaneListProps) => {
    const isLoading = props.isLoading === true
    return (
        <Stack gap="row">
            {props.search === undefined && props.choice === undefined ? null : (
                <FilterGroup
                    {...(props.search === undefined ? {} : { search: props.search })}
                    {...(props.choice === undefined ? {} : { choice: props.choice })}
                    isLoading={isLoading}
                />
            )}
            {props.summary === undefined ? null : (
                <Text size="xs" tone="muted" isLoading={isLoading}>
                    {props.summary}
                </Text>
            )}
            <ListBox
                label={props.label}
                selectionMode="single"
                selectionIndicator="none"
                selectedIds={props.selectedId === null ? [] : [props.selectedId]}
                onAction={props.onSelect}
                onSelectionChange={(ids) => {
                    const id = ids[0]
                    if (id !== undefined) props.onSelect(id)
                }}
                isLoading={isLoading}
                {...(props.error === undefined ? {} : { error: props.error })}
                emptyContent={emptyNoticeOf(props.empty)}
                {...(props.sections === undefined ? { items: props.items ?? [] } : { sections: props.sections })}
            />
            {props.footer === undefined || isLoading ? null : (
                <Text size="xs" tone="muted">
                    {props.footer}
                </Text>
            )}
            {props.footerAction === undefined || isLoading ? null : (
                <>
                    {props.footerAction.error === undefined ? null : (
                        <Text size="xs" tone="muted">
                            {props.footerAction.error}
                        </Text>
                    )}
                    <Button
                        intent="neutral"
                        size="sm"
                        isPending={props.footerAction.isPending === true}
                        onPress={props.footerAction.onPress}
                    >
                        {props.footerAction.label}
                    </Button>
                </>
            )}
        </Stack>
    )
}
