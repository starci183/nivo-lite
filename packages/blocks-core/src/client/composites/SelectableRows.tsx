import type { ReactNode } from "react"
import type { ReadPage } from "@nivo-lite/agent-sdk/block"
import { Avatar, Badge, Button, Cluster, ListBox, Stack, Text, type ListBoxItem } from "@starci/grammar/common"
import { chosenRow, moreStateOf, selectionOf, type RecordRow } from "../../rows/rows"

/** The words around the rows of a selectable list. */
export interface SelectableRowsWords {
    /** Names the list for assistive technology. */
    readonly label: string
    /** The command that loads the next page. */
    readonly loadMore: string
    /** What a failed page load says. */
    readonly loadFailed: string
    /** The command that tries the failed page again. */
    readonly retry: string
}

/** What a selectable list takes. */
interface SelectableRowsProps {
    readonly rows: ReadonlyArray<RecordRow>
    readonly words: SelectableRowsWords
    /** The id of the chosen row, from the selection param. */
    readonly selected: string | null
    /** The first read has no data yet: the rows draw as geometry. */
    readonly isLoading: boolean
    /** The paging of the read; null when it is not paged. */
    readonly page: ReadPage | null
    readonly onChoose: (id: string) => void
    /** Each row starts with the initials of its title. */
    readonly hasAvatar: boolean
}

/** The end of a row: its short fact and its badge, one over the other. */
const trailingOf = (row: RecordRow): ReactNode => (
    <Stack gap="inline" align="end">
        {row.meta === "" ? null : (
            <Text size="sm" tone="muted">
                {row.meta}
            </Text>
        )}
        {row.badge === "" ? null : (
            <Badge tone={row.tone} isDot>
                {row.badge}
            </Badge>
        )}
        {row.chips.map((chip) => (
            <Badge key={chip} tone="neutral">
                {chip}
            </Badge>
        ))}
    </Stack>
)

/** The row of the Grammar list for one record: its mark, its title, its line, its short fact and its badge. */
const itemOf = (row: RecordRow, hasAvatar: boolean): ListBoxItem => ({
    id: row.id,
    label: row.title,
    ...(hasAvatar ? { leading: <Avatar name={row.title} isDecorative /> } : {}),
    ...(row.description === "" ? {} : { description: row.description }),
    ...(row.meta === "" && row.badge === "" && row.chips.length === 0 ? {} : { trailing: trailingOf(row) }),
})

/** What the paging control takes. */
export interface LoadMoreProps {
    readonly page: ReadPage
    readonly words: SelectableRowsWords
}

/** The control under the rows that loads the next page, with the line and the retry of a failed load. */
export const LoadMore = (props: LoadMoreProps): ReactNode => {
    const state = moreStateOf(props.page)
    if (state === "none") return null
    return (
        <Cluster gap="inline" align="center">
            {state === "failed" ? (
                <Text size="sm" tone="muted">
                    {props.words.loadFailed}
                </Text>
            ) : null}
            <Button intent="neutral" size="sm" isPending={state === "loading"} onPress={props.page.loadMore}>
                {state === "failed" ? props.words.retry : props.words.loadMore}
            </Button>
        </Cluster>
    )
}

/** Rows to choose from: one is marked by the selection param, a press writes it, and the next page loads on request. */
export const SelectableRows = (props: SelectableRowsProps): ReactNode => (
    <Stack gap="row">
        <ListBox
            label={props.words.label}
            items={props.rows.map((row) => itemOf(row, props.hasAvatar))}
            selectionMode="single"
            selectionIndicator="none"
            selectedIds={selectionOf(props.selected)}
            onSelectionChange={(ids) => {
                const id = chosenRow(ids)
                if (id !== null) props.onChoose(id)
            }}
            isLoading={props.isLoading}
        />
        {props.page === null ? null : <LoadMore page={props.page} words={props.words} />}
    </Stack>
)
